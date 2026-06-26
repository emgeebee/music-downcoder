#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { getConfig, loadConfig } from "./config.js";
import type { Metadata } from "./getMeta.js";
import { normalizeDir } from "./paths.js";

interface SyncMetaResult {
  updated: number;
  unchanged: number;
  missingLocal: number;
  added: number;
  total: number;
}

const shouldSkipDir = (name: string): boolean =>
  name.startsWith("@") || name === "#recycle";

const isValidMetadata = (value: unknown): value is Metadata => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.fullArtist === "string" &&
    typeof meta.fullAlbum === "string" &&
    typeof meta.genre === "string" &&
    meta.year !== undefined
  );
};

const readLocalMeta = (dirPath: string): Metadata | null => {
  const backupFile = path.join(dirPath, "meta.json");
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(backupFile, "utf-8"));
    if (isValidMetadata(parsed)) {
      return parsed;
    }
  } catch {
    // no local meta.json or invalid contents
  }
  return null;
};

const walkLocalMeta = (
  start: string,
  found: Map<string, Metadata> = new Map()
): Map<string, Metadata> => {
  const dirPath = normalizeDir(start);
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return found;
  }

  const localMeta = readLocalMeta(dirPath);
  if (localMeta) {
    found.set(dirPath, localMeta);
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || shouldSkipDir(entry.name)) {
      continue;
    }
    walkLocalMeta(path.join(dirPath, entry.name), found);
  }

  return found;
};

const loadCentralMeta = (metaFile: string): Record<string, Metadata> => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, Metadata>;
  } catch {
    return {};
  }
};

export const syncMetaFromLocal = (configPath?: string): SyncMetaResult => {
  loadConfig(configPath ? path.resolve(configPath) : undefined);
  const config = getConfig();

  const central = loadCentralMeta(config.metaFile);
  const localByPath = new Map<string, Metadata>();

  for (const folder of config.startFolders) {
    walkLocalMeta(folder.path, localByPath);
  }

  let updated = 0;
  let unchanged = 0;
  let missingLocal = 0;

  for (const dirPath of Object.keys(central)) {
    const localMeta =
      readLocalMeta(dirPath) ?? localByPath.get(normalizeDir(dirPath));
    if (!localMeta) {
      missingLocal++;
      continue;
    }

    if (JSON.stringify(central[dirPath]) === JSON.stringify(localMeta)) {
      unchanged++;
      continue;
    }

    central[dirPath] = localMeta;
    updated++;
  }

  let added = 0;
  for (const [dirPath, localMeta] of localByPath) {
    if (central[dirPath]) {
      continue;
    }
    central[dirPath] = localMeta;
    added++;
  }

  fs.writeFileSync(config.metaFile, JSON.stringify(central, undefined, 2));

  return {
    updated,
    unchanged,
    missingLocal,
    added,
    total: Object.keys(central).length,
  };
};

const configArgIndex = process.argv.indexOf("-c");
const configPath =
  configArgIndex >= 0 ? process.argv[configArgIndex + 1] : undefined;

const result = syncMetaFromLocal(configPath);

console.log(`Synced ${getConfig().metaFile} from local album meta.json files.`);
console.log(`  updated: ${result.updated}`);
console.log(`  unchanged: ${result.unchanged}`);
console.log(`  no local meta: ${result.missingLocal}`);
console.log(`  added: ${result.added}`);
console.log(`  total entries: ${result.total}`);
