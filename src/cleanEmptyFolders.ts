#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { getConfig, loadConfig } from "./config.js";
import { normalizeDir } from "./paths.js";

const MEDIA_EXTENSIONS = new Set([
  ".mp3",
  ".ogg",
  ".m4a",
  ".flac",
  ".wav",
  ".aac",
  ".wma",
  ".opus",
  ".aiff",
  ".aif",
]);

const isMediaFile = (filename: string): boolean =>
  MEDIA_EXTENSIONS.has(path.extname(filename).toLowerCase());

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const logAccessError = (action: string, dirPath: string, error: unknown): void => {
  console.warn(`Could not ${action} ${dirPath}: ${formatError(error)}`);
};

const directoryHasMedia = (dirPath: string): boolean => {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (directoryHasMedia(fullPath)) {
        return true;
      }
      continue;
    }
    if (isMediaFile(entry.name)) {
      return true;
    }
  }

  return false;
};

const cleanEmptyDirectories = (dirPath: string): number => {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let removed = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    logAccessError("read", dirPath, error);
    return 0;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    removed += cleanEmptyDirectories(path.join(dirPath, entry.name));
  }

  if (!directoryHasMedia(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Removed ${dirPath}`);
      return removed + 1;
    } catch (error) {
      logAccessError("remove", dirPath, error);
      return removed;
    }
  }

  return removed;
};

export const cleanEncoderOutputFolders = (configPath?: string): number => {
  loadConfig(configPath ? path.resolve(configPath) : undefined);
  const config = getConfig();

  const outputRoots = [
    ...new Set(config.encoders.map((encoder) => normalizeDir(encoder.out))),
  ];

  let removed = 0;
  for (const outputRoot of outputRoots) {
    if (!fs.existsSync(outputRoot)) {
      console.log(`Skipping missing folder: ${outputRoot}`);
      continue;
    }

    console.log(`Cleaning ${outputRoot}...`);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(outputRoot, { withFileTypes: true });
    } catch (error) {
      logAccessError("read", outputRoot, error);
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      removed += cleanEmptyDirectories(path.join(outputRoot, entry.name));
    }
  }

  return removed;
};

const configArgIndex = process.argv.indexOf("-c");
const configPath =
  configArgIndex >= 0 ? process.argv[configArgIndex + 1] : undefined;

const removed = cleanEncoderOutputFolders(configPath);
console.log(`Removed ${removed} empty folder(s).`);
