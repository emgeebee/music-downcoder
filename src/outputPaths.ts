import fs from "fs";
import path from "path";

export const sanitiseMeta = (meta: string): string =>
  meta.replace(/\//g, "_").replace(/:/g, "_");

export const sanitisePathSegment = (segment: string): string =>
  sanitiseMeta(segment).trim();

export const buildArtistDirName = (fullArtist: string): string =>
  fullArtist === "Various Artists"
    ? "Compilations"
    : sanitisePathSegment(fullArtist);

export const buildArtistOutputDir = (
  outputRoot: string,
  genre: string,
  fullArtist: string
): string =>
  path.join(
    outputRoot,
    sanitisePathSegment(genre),
    buildArtistDirName(fullArtist)
  );

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface AlbumFolderMatch {
  folderName: string;
  year: string;
}

export const findAlbumFolderOnDisk = (
  artistDir: string,
  albumName: string
): AlbumFolderMatch | null => {
  if (!fs.existsSync(artistDir)) {
    return null;
  }

  const sanitisedAlbum = sanitisePathSegment(albumName);
  const escapedAlbum = escapeRegex(sanitisedAlbum);
  const yearPrefixPattern = new RegExp(`^\\((\\d{4})\\)\\s+${escapedAlbum}$`, "i");
  const plainPattern = new RegExp(`^${escapedAlbum}$`, "i");

  let plainMatch: string | null = null;

  for (const entry of fs.readdirSync(artistDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const yearMatch = entry.name.match(yearPrefixPattern);
    if (yearMatch) {
      return { folderName: entry.name, year: yearMatch[1] };
    }

    if (plainPattern.test(entry.name)) {
      plainMatch = entry.name;
    }
  }

  if (plainMatch) {
    return { folderName: plainMatch, year: "" };
  }

  return null;
};
