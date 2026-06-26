import fs from "fs";
import path from "path";
import type { AppConfig } from "./config.js";
import type { Metadata } from "./getMeta.js";
import { getMetaForSource } from "./metaStore.js";
import { normalizeDir } from "./paths.js";

export interface ScriptInfo {
  path: string;
  name: string;
  displayName: string;
  artist: string;
  album: string;
  type: string;
  trackCount: number;
  commands: string[];
  sourcePath: string | null;
  meta: Metadata | null;
}

const extractLastQuotedPath = (line: string): string | null => {
  const matches = [...line.matchAll(/"([^"]+)"/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
};

const countTracks = (lines: string[]): number => {
  const echoCount = lines.filter((line) => /echo "Copying /.test(line)).length;
  if (echoCount > 0) {
    return echoCount;
  }

  const rsyncCount = lines.filter((line) => /\brsync\b/.test(line)).length;
  if (rsyncCount > 0) {
    return rsyncCount;
  }

  const encodeCount = lines.filter((line) =>
    /-f (mp3|ogg)  "/.test(line)
  ).length;
  if (encodeCount > 0) {
    return encodeCount;
  }

  return lines.filter((line) => line.trim().length > 0).length;
};

export const parseEncoderFromFilename = (
  basename: string,
  config: AppConfig
): { id: string; label: string } => {
  for (const encoder of config.encoders) {
    const suffix = `-${encoder.id}-commands.sh`;
    if (basename.endsWith(suffix)) {
      return { id: encoder.id, label: encoder.label };
    }
  }
  const fallback = basename.replace(/-commands\.sh$/, "").split("-").pop() ?? "unknown";
  return { id: fallback, label: fallback };
};

const parseLocationFromOutput = (
  outputPath: string,
  encoderOut: string
): { artist: string; album: string } | null => {
  const rel = path.relative(normalizeDir(encoderOut), outputPath);
  if (rel.startsWith("..")) {
    return null;
  }

  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length < 4) {
    return null;
  }

  return { artist: parts[1], album: parts[2] };
};

const encoderOutForId = (encoderId: string, config: AppConfig): string | null => {
  const encoder = config.encoders.find((entry) => entry.id === encoderId);
  return encoder ? normalizeDir(encoder.out) : null;
};

const unescapeShellPath = (value: string): string =>
  value.replace(/\\([`$"\\])/g, "$1");

export const extractSourceDirFromScript = (lines: string[]): string | null => {
  for (const line of lines) {
    if (line.trimStart().startsWith("mkdir ")) {
      continue;
    }

    const rsyncMatch = line.match(/\brsync\b[^"\n]*"([^"]+)"/);
    if (rsyncMatch) {
      return path.dirname(unescapeShellPath(rsyncMatch[1]));
    }

    const ffmpegMatch = line.match(/\bffmpeg\b[^"\n]*-i\s+"([^"]+)"/);
    if (ffmpegMatch) {
      return path.dirname(unescapeShellPath(ffmpegMatch[1]));
    }
  }

  return null;
};

export const describeScript = (
  scriptPath: string,
  config: AppConfig
): ScriptInfo => {
  const basename = path.basename(scriptPath);
  const encoder = parseEncoderFromFilename(basename, config);
  const encoderOut = encoderOutForId(encoder.id, config);

  let artist = "Unknown artist";
  let album = "Unknown album";
  let trackCount = 0;
  let commands: string[] = [];
  let lines: string[] = [];

  try {
    const content = fs.readFileSync(scriptPath, "utf-8");
    lines = content.split("\n");
    trackCount = countTracks(lines);
    commands = lines.map((line) => line.trimEnd()).filter((line) => line.length > 0);

    if (encoderOut) {
      for (const line of lines) {
        const outputPath = extractLastQuotedPath(line);
        if (!outputPath) {
          continue;
        }
        const location = parseLocationFromOutput(outputPath, encoderOut);
        if (location) {
          artist = location.artist;
          album = location.album;
          break;
        }
      }
    }
  } catch {
    // fall back to filename-based labels below
  }

  const displayName = `${artist} / ${album} / ${encoder.label} / ${trackCount}`;
  const sourcePath = extractSourceDirFromScript(lines);
  const meta = sourcePath ? getMetaForSource(config, sourcePath) : null;

  return {
    path: scriptPath,
    name: path.relative(config.commandsFolder, scriptPath),
    displayName,
    artist,
    album,
    type: encoder.label,
    trackCount,
    commands,
    sourcePath,
    meta,
  };
};

export const describeScripts = (
  scriptPaths: string[],
  config: AppConfig
): ScriptInfo[] => scriptPaths.map((scriptPath) => describeScript(scriptPath, config));
