import fs from "fs";
import path from "path";
import {
  normalizeDir,
  resolveConfigPath,
} from "./paths.js";

export interface StartFolder {
  name: string;
  path: string;
}

export interface EncoderConfig {
  id: string;
  label: string;
  description?: string;
  default?: boolean;
  out: string;
  format: string;
  getImages?: boolean;
}

export interface AppConfig {
  ffmpeg: string;
  rate: string;
  numOfCores: number;
  commandsFolder: string;
  queueFolder: string;
  metaFile: string;
  workDir: string;
  autoConfirm: boolean;
  startFolders: StartFolder[];
  encoders: EncoderConfig[];
}

export type ConfigKey = string;

export interface ConfigMap {
  [key: string]: {
    start: string;
    out: string;
    format: string;
    getImages?: boolean;
  };
}

const defaultConfig: AppConfig = {
  ffmpeg: "/Applications/ffmpeg",
  rate: "0",
  numOfCores: 4,
  commandsFolder: "./cmd",
  queueFolder: "./queueInProgress",
  metaFile: "./meta.json",
  workDir: process.cwd(),
  autoConfirm: false,
  startFolders: [
    { name: "Itunes", path: "/Volumes/Itunes/Music/Music/" },
    { name: "Downloads", path: "/Volumes/Music/downloads/" },
    { name: "Youtube", path: "/Users/mat/Music/youtube" },
  ],
  encoders: [
    {
      id: "alac",
      label: "COPY",
      description: "Copies the files directly",
      default: true,
      out: "/Volumes/Music/cds-alac",
      format: "cp",
      getImages: false,
    },
    {
      id: "main",
      label: "mp3",
      default: true,
      out: "/Volumes/Music/cds-mp3",
      format: "mp3",
    },
    {
      id: "ogg",
      label: "ogg",
      default: false,
      out: "/Volumes/Music/cds-ogg",
      format: "ogg",
      getImages: false,
    },
  ],
};

let activeConfig: AppConfig = { ...defaultConfig };

export const getConfig = (): AppConfig => activeConfig;

export const buildConfigMap = (
  startFolder: string,
  encoderIds: ConfigKey[]
): ConfigMap => {
  const map: ConfigMap = {};
  for (const encoder of activeConfig.encoders) {
    if (!encoderIds.includes(encoder.id)) {
      continue;
    }
    map[encoder.id] = {
      start: normalizeDir(startFolder),
      out: normalizeDir(encoder.out),
      format: encoder.format,
      getImages: encoder.getImages,
    };
  }
  return map;
};

export const loadConfig = (configPath?: string): AppConfig => {
  if (!configPath) {
    activeConfig = { ...defaultConfig, workDir: process.cwd() };
    return activeConfig;
  }

  const resolved = path.resolve(configPath);
  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8")) as Partial<AppConfig>;
  const configDir = path.dirname(resolved);

  activeConfig = {
    ...defaultConfig,
    ...raw,
    ffmpeg: raw.ffmpeg ?? defaultConfig.ffmpeg,
    workDir: raw.workDir
      ? resolveConfigPath(configDir, raw.workDir)
      : normalizeDir(configDir),
    commandsFolder: raw.commandsFolder
      ? resolveConfigPath(configDir, raw.commandsFolder)
      : resolveConfigPath(configDir, "cmd"),
    queueFolder: raw.queueFolder
      ? resolveConfigPath(configDir, raw.queueFolder)
      : resolveConfigPath(configDir, "queueInProgress"),
    metaFile: raw.metaFile
      ? resolveConfigPath(configDir, raw.metaFile)
      : path.join(configDir, "meta.json"),
    startFolders: (raw.startFolders ?? defaultConfig.startFolders).map(
      (folder) => ({
        ...folder,
        path: normalizeDir(folder.path),
      })
    ),
    encoders: (raw.encoders ?? defaultConfig.encoders).map((encoder) => ({
      ...encoder,
      out: resolveConfigPath(configDir, encoder.out),
    })),
  };

  return activeConfig;
};
