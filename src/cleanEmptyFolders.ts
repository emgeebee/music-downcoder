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
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    removed += cleanEmptyDirectories(path.join(dirPath, entry.name));
  }

  if (!directoryHasMedia(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Removed ${dirPath}`);
    return removed + 1;
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
    const entries = fs.readdirSync(outputRoot, { withFileTypes: true });
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
