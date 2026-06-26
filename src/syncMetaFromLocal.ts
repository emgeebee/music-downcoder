#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { getConfig, loadConfig } from "./config.js";
import type { Metadata } from "./getMeta.js";
import { normalizeDir } from "./paths.js";

interface SyncMetaResult {
  updated: number;
  unchanged: number;
  missingFolder: number;
  failed: number;
  total: number;
}

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

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const syncMetaToLocal = (configPath?: string): SyncMetaResult => {
  loadConfig(configPath ? path.resolve(configPath) : undefined);
  const config = getConfig();

  const central = loadCentralMeta(config.metaFile);

  let updated = 0;
  let unchanged = 0;
  let missingFolder = 0;
  let failed = 0;

  for (const [dirPath, meta] of Object.entries(central)) {
    if (!isValidMetadata(meta)) {
      continue;
    }

    const albumDir = normalizeDir(dirPath);
    if (!fs.existsSync(albumDir)) {
      missingFolder++;
      continue;
    }

    const localMeta = readLocalMeta(albumDir);
    if (localMeta && JSON.stringify(localMeta) === JSON.stringify(meta)) {
      unchanged++;
      continue;
    }

    const backupFile = path.join(albumDir, "meta.json");
    try {
      fs.writeFileSync(backupFile, JSON.stringify(meta));
      updated++;
    } catch (error) {
      console.warn(`Could not write ${backupFile}: ${formatError(error)}`);
      failed++;
    }
  }

  return {
    updated,
    unchanged,
    missingFolder,
    failed,
    total: Object.keys(central).length,
  };
};

const configArgIndex = process.argv.indexOf("-c");
const configPath =
  configArgIndex >= 0 ? process.argv[configArgIndex + 1] : undefined;

const result = syncMetaToLocal(configPath);

console.log(`Synced ${getConfig().metaFile} to local album meta.json files.`);
console.log(`  updated: ${result.updated}`);
console.log(`  unchanged: ${result.unchanged}`);
console.log(`  missing folder: ${result.missingFolder}`);
console.log(`  failed: ${result.failed}`);
console.log(`  total entries: ${result.total}`);
