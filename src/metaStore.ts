import fs from "fs";
import path from "path";
import type { AppConfig } from "./config.js";
import type { Metadata } from "./getMeta.js";
import { normalizeDir } from "./paths.js";

export const isValidMetadata = (value: unknown): value is Metadata => {
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

export const loadCentralMeta = (
  metaFile: string
): Record<string, Metadata> => {
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

export const findMetaKey = (
  central: Record<string, Metadata>,
  sourcePath: string
): string | null => {
  const normalized = normalizeDir(sourcePath);
  if (central[sourcePath]) {
    return sourcePath;
  }
  if (central[normalized]) {
    return normalized;
  }
  for (const key of Object.keys(central)) {
    if (normalizeDir(key) === normalized) {
      return key;
    }
  }
  return null;
};

export const getMetaForSource = (
  config: AppConfig,
  sourcePath: string
): Metadata | null => {
  const central = loadCentralMeta(config.metaFile);
  const key = findMetaKey(central, sourcePath);
  return key ? central[key] : null;
};

export const saveMetaEntry = (
  config: AppConfig,
  sourcePath: string,
  meta: Metadata
): string => {
  const central = loadCentralMeta(config.metaFile);
  const key = findMetaKey(central, sourcePath) ?? normalizeDir(sourcePath);
  central[key] = meta;
  fs.writeFileSync(config.metaFile, JSON.stringify(central, undefined, 2));

  const albumDir = normalizeDir(sourcePath);
  if (fs.existsSync(albumDir)) {
    fs.writeFileSync(path.join(albumDir, "meta.json"), JSON.stringify(meta));
  }

  return key;
};
