#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { getConfig, loadConfig } from "./config.js";
import type { Metadata } from "./getMeta.js";
import {
  buildArtistOutputDir,
  findAlbumFolderOnDisk,
} from "./outputPaths.js";
import { createCliPrompts } from "./prompts.js";

interface MetaCache {
  [sourcePath: string]: Metadata;
}

const normalizeYear = (year: string | undefined): string => year?.trim() ?? "";

const loadMetaCache = (metaFile: string): MetaCache => {
  try {
    return JSON.parse(fs.readFileSync(metaFile, "utf-8")) as MetaCache;
  } catch {
    return {};
  }
};

const writeLocalBackup = (sourcePath: string, meta: Metadata): void => {
  const backupFile = path.join(sourcePath, "meta.json");
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  fs.writeFileSync(backupFile, JSON.stringify(meta));
};

export const repairMetaYearsFromAlac = async (
  configPath?: string
): Promise<{ checked: number; updated: number; missing: number; matched: number }> => {
  loadConfig(configPath ? path.resolve(configPath) : undefined);
  const config = getConfig();
  const prompts = createCliPrompts();

  const alacEncoder = config.encoders.find((encoder) => encoder.id === "alac");
  if (!alacEncoder) {
    throw new Error("No alac encoder found in config");
  }

  const metaData = loadMetaCache(config.metaFile);
  const entries = Object.entries(metaData);

  let checked = 0;
  let updated = 0;
  let missing = 0;
  let matched = 0;

  for (const [sourcePath, meta] of entries) {
    checked++;
    const artistDir = buildArtistOutputDir(
      alacEncoder.out,
      meta.genre,
      meta.fullArtist
    );
    const folderMatch = findAlbumFolderOnDisk(artistDir, meta.fullAlbum);

    if (!folderMatch) {
      missing++;
      continue;
    }

    matched++;
    const metaYear = normalizeYear(meta.year);
    const diskYear = normalizeYear(folderMatch.year);

    if (metaYear === diskYear) {
      continue;
    }

    const accept = await prompts.confirm(
      `Update ${meta.fullArtist} / ${meta.fullAlbum}\n` +
        `  folder: ${folderMatch.folderName}\n` +
        `  meta year: ${metaYear || "(none)"} -> ${diskYear || "(none)"}?`,
      true
    );

    if (!accept) {
      continue;
    }

    meta.year = diskYear;
    metaData[sourcePath] = meta;
    writeLocalBackup(sourcePath, meta);
    updated++;
  }

  if (updated > 0) {
    fs.writeFileSync(config.metaFile, JSON.stringify(metaData, undefined, 2));
  }

  return { checked, updated, missing, matched };
};

const configArgIndex = process.argv.indexOf("-c");
const configPath =
  configArgIndex >= 0 ? process.argv[configArgIndex + 1] : undefined;

const result = await repairMetaYearsFromAlac(configPath);

console.log(`Checked ${result.checked} meta entries.`);
console.log(`  matched on disk: ${result.matched}`);
console.log(`  no album folder: ${result.missing}`);
console.log(`  updated: ${result.updated}`);
