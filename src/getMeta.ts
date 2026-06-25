import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { AppConfig } from "./config.js";
import type { Prompts } from "./prompts.js";
import { shellPath } from "./paths.js";

const FFMPEG_TIMEOUT_MS = 30_000;

export interface Metadata {
  fullArtist: string;
  fullAlbum: string;
  genre: string;
  year: string;
}

interface MetadataCache {
  [dirPath: string]: Metadata;
}

const readFfmpegMetadata = (
  ffmpeg: string,
  inputPath: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      ffmpeg,
      ["-y", "-i", inputPath, "-f", "ffmetadata", "pipe:1"],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS / 1000}s: ${inputPath}`));
    }, FFMPEG_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        reject(new Error(`ffmpeg failed (${code}) for ${inputPath}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
  });

export class MetaGetter {
  private metaData: MetadataCache = {};
  private usemetaFiles = true;

  constructor(
    private readonly config: AppConfig,
    private readonly prompts: Prompts
  ) {
    try {
      this.metaData = JSON.parse(fs.readFileSync(config.metaFile, "utf-8"));
    } catch {
      // File doesn't exist yet
    }
  }

  async getMeta(dirPath: string, filename: string): Promise<Metadata> {
    const backupFile = path.join(dirPath, "meta.json");
    if (
      this.metaData[dirPath] &&
      this.metaData[dirPath].year !== undefined &&
      this.usemetaFiles
    ) {
      const { fullArtist, fullAlbum } = this.metaData[dirPath];
      console.log("read meta for %s: %s", fullArtist, fullAlbum);
    } else {
      try {
        const backupMeta = fs.readFileSync(backupFile, "utf-8");
        if (backupMeta && JSON.parse(backupMeta).year !== undefined) {
          const { fullAlbum, fullArtist, genre, year } = JSON.parse(backupMeta);
          console.log("read backup meta for %s: %s", fullArtist, fullAlbum);
          this.metaData[dirPath] = { fullAlbum, fullArtist, genre, year };
        }
        throw new Error("no complete backup file");
      } catch {
        console.log(` no backup file at ${backupFile}, falling back to ffmpeg`);
        const inputPath = shellPath(dirPath, filename);
        const meta = await readFfmpegMetadata(this.config.ffmpeg, inputPath);
        const genreMatch = meta.match(/genre.*/gi);
        const genre = genreMatch ? genreMatch[0].split("=")[1] : "";

        const artistReg = new RegExp(/[\t]*artist=(.*)$/gim);
        const albumArtistReg = new RegExp(/[\t]*album_artist=(.*)$/gim);
        const albumReg = new RegExp(/[\t]*album=(.*)$/gim);
        const yearReg = new RegExp(/[\t]*date=(.*)$/gim);

        const fullArtistResults = artistReg.exec(meta);
        const fullAlbumArtistResults = albumArtistReg.exec(meta);
        const fullAlbumResults = albumReg.exec(meta);
        const yearResults = yearReg.exec(meta);

        let fullArtist = "";
        let fullAlbum = "";

        if (fullAlbumResults && (fullArtistResults || fullAlbumArtistResults)) {
          fullArtist = fullAlbumArtistResults
            ? fullAlbumArtistResults[1]
            : fullArtistResults?.[1] ?? "";
          fullAlbum = fullAlbumResults ? fullAlbumResults[1] : "";
        }

        const possibleYear = yearResults?.[1]?.slice(0, 4)?.trim() ?? "";

        const confirmedAll = await this.prompts.confirm(
          `Use genre = ${genre}, artist = ${fullArtist}, album = ${fullAlbum}, year = ${possibleYear}`
        );

        let confirmedArtist = "";
        let confirmedAlbum = "";
        let confirmedGenre = "";
        let confirmedYear = "";

        if (confirmedAll) {
          confirmedArtist = fullArtist;
          confirmedAlbum = fullAlbum;
          confirmedGenre = genre;
          confirmedYear = possibleYear;
        } else {
          confirmedGenre = await this.prompts.input(`Use Genre: ${genre}`, genre);
          confirmedArtist = await this.prompts.input(
            `Use Artist: ${fullArtist}`,
            fullArtist
          );
          confirmedAlbum = await this.prompts.input(
            `Use Album: ${fullAlbum}`,
            fullAlbum
          );
          confirmedYear = await this.prompts.input(
            `Use Year: ${possibleYear}`,
            possibleYear
          );
        }

        this.metaData[dirPath] = {
          fullArtist: confirmedArtist,
          fullAlbum: confirmedAlbum,
          genre: confirmedGenre,
          year: confirmedYear,
        };
      }
    }

    const output: Metadata = {
      fullArtist: this.metaData[dirPath].fullArtist,
      fullAlbum: this.metaData[dirPath].fullAlbum,
      genre: this.metaData[dirPath].genre,
      year: this.metaData[dirPath].year,
    };

    fs.writeFile(backupFile, JSON.stringify(output), () => {});

    return output;
  }

  writeBack(): void {
    fs.writeFileSync(
      this.config.metaFile,
      JSON.stringify(this.metaData, undefined, 2)
    );
  }
}
