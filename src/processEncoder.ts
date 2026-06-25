#!/usr/bin/env node

import fs from "fs";
import fse from "fs-extra";
import path from "path";
import type { AppConfig, ConfigKey, ConfigMap } from "./config.js";
import { MetaGetter, Metadata } from "./getMeta.js";
import type { Prompts } from "./prompts.js";
import { relativeFrom, normalizeDir } from "./paths.js";
import { setJobProgress } from "./progress.js";

interface FileCollection {
  names: string[];
  dirs: string[];
}

interface OutputPathResult {
  path: string;
  shouldProcess: boolean;
  isCopy: boolean;
}

interface CheckFilesContext {
  configKey: ConfigKey;
  startFolder: string;
  metaCache: MetadataCache;
  configMap: ConfigMap;
  metaGetter: MetaGetter;
  prompts: Prompts;
  appConfig: AppConfig;
}

interface MetadataCache {
  [album: string]: Metadata;
}

interface CommandsMap {
  [album: string]: string[];
}

interface ProcessResults {
  commands: CommandsMap;
  foldersToCreate: string[];
  metaCache: MetadataCache;
}

type FileFilter = (name: string) => boolean;
type WalkCallback<T> = (
  dirPath: string,
  dirs: string[],
  files: string[]
) => Promise<T>;

const pathSanitiser = (i: string): string => i.replace(/[`\$\"]/g, "\\$&");
const sanitiseMeta = (meta: string): string =>
  meta.replace(/\//g, "_").replace(/:/g, "_");

const sanitisePathSegment = (segment: string): string =>
  sanitiseMeta(segment).trim();

const isValidYear = (year: string): boolean => {
  const trimmed = year.trim();
  if (!trimmed || trimmed === "0" || trimmed === "0000") {
    return false;
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return false;
  }
  const numericYear = Number(trimmed);
  return numericYear >= 1900 && numericYear <= 2100;
};

const formatAlbumDirName = (year: string, albumName: string): string => {
  const name = sanitisePathSegment(albumName);
  if (!isValidYear(year)) {
    return name;
  }
  return `${`(${year.trim()}) `}${name}`.trim();
};

const canRenameFolder = (from: string, to: string): boolean => {
  const normalizedFrom = path.normalize(from);
  const normalizedTo = path.normalize(to);
  if (normalizedFrom === normalizedTo) {
    return false;
  }
  if (normalizedTo.startsWith(normalizedFrom + path.sep)) {
    return false;
  }
  if (normalizedFrom.startsWith(normalizedTo + path.sep)) {
    return false;
  }
  if (path.dirname(normalizedFrom) !== path.dirname(normalizedTo)) {
    return false;
  }
  return true;
};

const shouldSkipDir = (name: string): boolean =>
  name.startsWith("@") || name === "#recycle";

const shouldSkipFile = (name: string): boolean =>
  name.startsWith("@") ||
  name.startsWith(".") ||
  name.includes("@SynoEAStream");

export const walkSync = async function <T>(
  start: string,
  callback: WalkCallback<T>,
  fileFilter: FileFilter = () => true
): Promise<T[]> {
  const stat = fs.statSync(start);

  if (stat.isDirectory()) {
    const filenames = fs.readdirSync(start);

    const coll = filenames.filter(fileFilter).reduce(
      (acc: FileCollection, name: string) => {
        const abspath = path.join(start, name);

        if (fs.statSync(abspath).isDirectory()) {
          if (!shouldSkipDir(name)) {
            acc.dirs.push(name);
          }
        } else if (!shouldSkipFile(name)) {
          acc.names.push(name);
        }

        return acc;
      },
      { names: [], dirs: [] }
    );

    const result = await callback(start, coll.dirs, coll.names);
    setJobProgress(`Scanning ${start}...`);

    const results: T[] = [result];
    for (const d of coll.dirs) {
      const abspath = path.join(start, d);
      const subResults = await walkSync(abspath, callback, () => true);
      results.push(...subResults);
    }

    return results.flat() as T[];
  }

  throw new Error("path: " + start + " is not a directory");
};

const getOutputPath = (
  file: string,
  configKey: ConfigKey,
  configMap: ConfigMap
): OutputPathResult => {
  const encoderConfig = configMap[configKey];
  const outputFormat = encoderConfig.format;
  const outputFormatExtension = "." + outputFormat;
  const outputFormatExtensionRegex = new RegExp("." + outputFormat);

  const isCopy =
    outputFormat === "cp" ||
    outputFormatExtensionRegex.test(file) ||
    new RegExp("mp3").test(file);

  const isAudioFile = new RegExp(".m4a|flac|wav|mp3").test(file);
  if (!isAudioFile) {
    return { path: file, shouldProcess: false, isCopy };
  }

  if (isCopy) {
    return { path: file, shouldProcess: true, isCopy };
  }

  const resultPath =
    path.extname(file).length > 0
      ? path.basename(file, path.extname(file)) + outputFormatExtension
      : file + outputFormatExtension;

  const shouldProcess = new RegExp(outputFormatExtension).test(resultPath);

  return { path: resultPath, shouldProcess, isCopy };
};

const buildEncodingCommands = (
  filepath: string,
  output: string,
  configKey: ConfigKey,
  configMap: ConfigMap,
  appConfig: AppConfig
): string[] => {
  const outputFormat = configMap[configKey].format;
  const metaFile = path.join(
    path.dirname(output),
    path.basename(output, path.extname(output)) + ".txt"
  );
  const ffmpeg = appConfig.ffmpeg;

  const cmd: string[] = [];
  cmd.push(`${ffmpeg} -i "${filepath}" -f ffmetadata "${metaFile}"`);
  cmd.push('sed -i".bak" "/^major_brand/d" "' + metaFile + '"');
  cmd.push('sed -i".bak" "/^minor_version/d" "' + metaFile + '"');
  cmd.push('sed -i".bak" "/^compatible_brands/d" "' + metaFile + '"');
  cmd.push('sed -i".bak" "/^gapless_playback/d" "' + metaFile + '"');
  cmd.push('sed -i".bak" "/^encoder/d" "' + metaFile + '"');

  if (configMap[configKey].format === "ogg") {
    cmd.push(
      `${ffmpeg} -i "${filepath}"  -i "${metaFile}" -map 0:0 -map_metadata 1 -c:a libvorbis -ar 44100 -qscale:a 8 -f ${outputFormat}  "${output}"`
    );
  } else {
    cmd.push(
      `${ffmpeg} -i "${filepath}"  -i "${metaFile}" -map_metadata 1 -vn -c:a libmp3lame -ar 44100 -q:a ${appConfig.rate} -id3v2_version 3 -f ${outputFormat}  "${output}"`
    );
  }
  cmd.push('rm "' + metaFile + '"');
  cmd.push('rm "' + metaFile + '.bak"');
  return cmd;
};

const buildCopyCommands = (filepath: string, output: string): string[] => {
  const filename = path.basename(output);
  return [`echo "Copying ${filename}" && rsync -ah "${filepath}" "${output}"`];
};

const buildCommand = (
  filepath: string,
  output: string,
  isCopy: boolean,
  configKey: ConfigKey,
  configMap: ConfigMap,
  appConfig: AppConfig
): string[] => {
  return isCopy
    ? buildCopyCommands(filepath, output)
    : buildEncodingCommands(filepath, output, configKey, configMap, appConfig);
};

const checkFiles = async (
  dirPath: string,
  _dirs: string[],
  files: string[],
  context: CheckFilesContext
): Promise<ProcessResults> => {
  const {
    configKey,
    startFolder,
    metaCache,
    configMap,
    metaGetter,
    prompts,
    appConfig,
  } = context;

  let album = relativeFrom(startFolder, dirPath);
  const sanistisedDirPath = dirPath.replace(/[`]/g, "`");
  const outputDir = configMap[configKey].out;

  const results: ProcessResults = {
    commands: {},
    foldersToCreate: [],
    metaCache: { ...metaCache },
  };

  for (const file of files) {
    if (shouldSkipFile(file)) {
      continue;
    }

    const {
      shouldProcess,
      path: outputPath,
      isCopy,
    } = getOutputPath(file, configKey, configMap);

    if (!shouldProcess) {
      continue;
    }

    const filename = file.replace(/[`]/g, "`");

    if (!RegExp("/").test(album)) {
      const meta = await metaGetter.getMeta(sanistisedDirPath, file);
      album = path.join(meta.fullArtist, album);
    }

    if (results.metaCache[album] === undefined) {
      results.metaCache[album] = await metaGetter.getMeta(
        sanistisedDirPath,
        file
      );
    }

    let artist =
      results.metaCache[album].fullArtist === "Various Artists"
        ? "Compilations"
        : sanitisePathSegment(results.metaCache[album].fullArtist);
    const genre = sanitisePathSegment(results.metaCache[album].genre);
    let albumName = sanitisePathSegment(results.metaCache[album].fullAlbum);
    if (!artist) {
      artist = sanitisePathSegment(path.basename(path.dirname(sanistisedDirPath)));
    }
    if (!albumName) {
      albumName = sanitisePathSegment(path.basename(sanistisedDirPath));
    }

    const oldOutputFolder = path.join(outputDir, genre, artist, albumName);
    const outputFolder = path.join(
      outputDir,
      genre,
      artist,
      formatAlbumDirName(results.metaCache[album].year, albumName)
    );
    const output = pathSanitiser(path.join(outputFolder, outputPath));
    const filepath = pathSanitiser(path.join(sanistisedDirPath, filename));

    if (!fs.existsSync(outputFolder)) {
      if (fs.existsSync(oldOutputFolder)) {
        const shouldRename = await prompts.confirm(
          `Rename ${oldOutputFolder} to '${outputFolder}'?`
        );

        if (shouldRename && canRenameFolder(oldOutputFolder, outputFolder)) {
          try {
            fs.renameSync(oldOutputFolder, outputFolder);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            console.warn(
              `Could not rename ${oldOutputFolder} to ${outputFolder}: ${message}`
            );
          }
        }
      }
    }

    let existingFiles: string[] = [];
    try {
      existingFiles = fs.readdirSync(outputFolder);
    } catch {
      results.foldersToCreate.push(outputFolder);
    }

    if (existingFiles.indexOf(outputPath) < 0) {
      const commands = buildCommand(
        filepath,
        output,
        isCopy,
        configKey,
        configMap,
        appConfig
      );
      if (!results.commands[album]) {
        results.commands[album] = [];
      }
      results.commands[album].push(...commands);
    }
  }

  return results;
};

const mergeResults = (
  accumulator: ProcessResults,
  current: ProcessResults
): ProcessResults => {
  Object.keys(current.commands).forEach((album) => {
    if (!accumulator.commands[album]) {
      accumulator.commands[album] = [];
    }
    accumulator.commands[album].push(...current.commands[album]);
  });

  const newFolders = current.foldersToCreate.filter(
    (folder) => !accumulator.foldersToCreate.includes(folder)
  );
  accumulator.foldersToCreate.push(...new Set(newFolders));
  accumulator.metaCache = { ...accumulator.metaCache, ...current.metaCache };

  return accumulator;
};

const sanitizeScriptName = (album: string): string =>
  album.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "album";

const writeCommands = (
  commands: CommandsMap,
  configKey: ConfigKey,
  appConfig: AppConfig
): void => {
  Object.keys(commands).forEach((albums, i) => {
    console.log(`writing commands for ${albums}`);
    const filePath = path.join(
      appConfig.commandsFolder,
      String(i % appConfig.numOfCores),
      `${sanitizeScriptName(albums)}-${configKey}-commands.sh`
    );
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, commands[albums].join("\n"));
  });
};

const artistFilter =
  (filter: string): FileFilter =>
  (artist: string) => {
    if (
      Boolean(filter) &&
      !artist.toLowerCase().startsWith(filter.toLowerCase())
    ) {
      return false;
    }
    return true;
  };

export const processEncoder = async (
  configKey: ConfigKey,
  startFolder: string,
  filter: string,
  appConfig: AppConfig,
  configMap: ConfigMap,
  metaGetter: MetaGetter,
  prompts: Prompts
): Promise<ProcessResults> => {
  const normalizedStart = normalizeDir(startFolder);
  console.log("================");
  console.log("================");
  console.log(`Using key "${configKey}" with filter ${filter}`);
  console.log(JSON.stringify(configMap[configKey], undefined, 2));
  console.log("================");
  console.log("================");

  console.log(`starting to walk ${normalizedStart}`);

  const context: CheckFilesContext = {
    configKey,
    startFolder: normalizedStart,
    metaCache: {},
    configMap,
    metaGetter,
    prompts,
    appConfig,
  };

  const results = await walkSync(
    normalizedStart,
    (dirPath: string, dirs: string[], files: string[]) =>
      checkFiles(dirPath, dirs, files, context),
    artistFilter(filter)
  );

  const finalResults = results.reduce(mergeResults, {
    commands: {},
    foldersToCreate: [],
    metaCache: {},
  });

  metaGetter.writeBack();
  writeCommands(finalResults.commands, configKey, appConfig);

  for (const outputFolder of finalResults.foldersToCreate) {
    const confirmation = await prompts.confirm(`Create folder: ${outputFolder}`);
    if (confirmation) {
      console.log(`creating folder: ${outputFolder}`);
      fse.ensureDir(outputFolder);
    }
  }

  return finalResults;
};

export const listCommandScripts = (appConfig: AppConfig): string[] => {
  if (!fs.existsSync(appConfig.commandsFolder)) {
    return [];
  }

  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".sh")) {
        results.push(fullPath);
      }
    }
  };
  walk(appConfig.commandsFolder);
  return results.sort();
};

export const prepareCommandFolders = (appConfig: AppConfig): void => {
  fse.ensureDirSync(appConfig.queueFolder);
  for (let i = appConfig.numOfCores - 1; i >= 0; i--) {
    const folder = path.join(appConfig.commandsFolder, String(i));
    fse.ensureDirSync(folder);
    fse.emptyDirSync(folder);
  }
};

export const clearCommandScripts = (appConfig: AppConfig): number => {
  const count = listCommandScripts(appConfig).length;
  prepareCommandFolders(appConfig);
  return count;
};
