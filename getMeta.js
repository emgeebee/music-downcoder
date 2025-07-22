"use strict";

import term from "child_process";
import fs from "fs";
import { input } from "@inquirer/prompts";

const metaFile = "./meta.json";
let metaData = {};
try {
  metaData = JSON.parse(fs.readFileSync(metaFile));
} catch (e) {}

function getMeta() {
  this.usemetaFiles = true;
}

getMeta.prototype = {
  getMeta: async function (path, filename) {
    const backupFile = `${path}/meta.json`;
    if (metaData[path] && this.usemetaFiles) {
      const { fullArtist, fullAlbum } = metaData[path];
      console.log("read meta for %s: %s", fullArtist, fullAlbum);
    } else {
      try {
        const backupMeta = fs.readFileSync(backupFile);
        if (backupMeta) {
          const { fullAlbum, fullArtist, genre } = JSON.parse(backupMeta);
          console.log("read backup meta for %s: %s", fullArtist, fullAlbum);
          metaData[path] = { fullAlbum, fullArtist, genre };
        }
      } catch (e) {
        console.log(` no backup file at ${backupFile}, falling back to ffmpeg`);
        var meta = term.execSync(
          '/Applications/ffmpeg -y -i "' +
            path +
            "/" +
            filename +
            '" -f ffmetaData pipe:1',
          { encoding: "utf-8" }
        );
        const genre = meta.match(/genre.*/gi)[0].split("=")[1];

        const artistReg = new RegExp(/[\t]*artist=(.*)$/gim);
        const albumArtistReg = new RegExp(/[\t]*album_artist=(.*)$/gim);
        const albumReg = new RegExp(/[\t]*album=(.*)$/gim);

        const fullArtistResults = artistReg.exec(meta);
        const fullAlbumArtistResults = albumArtistReg.exec(meta);
        const fullAlbumResults = albumReg.exec(meta);

        console.log(
          fullAlbumResults,
          fullAlbumArtistResults,
          fullArtistResults
        );

        let fullArtist = "";
        let fullAlbum = "";

        if (fullAlbumResults && (fullArtistResults || fullAlbumArtistResults)) {
          fullArtist = fullAlbumArtistResults
            ? fullAlbumArtistResults[1]
            : fullArtistResults[1];
          fullAlbum = fullAlbumResults ? fullAlbumResults[1] : null;
        }

        const confirmedGenre = await input({
          message: `Use Genre: ${genre}`,
          default: genre,
        });

        const confirmedArtist = await input({
          message: `Use Artist: ${fullArtist}`,
          default: fullArtist,
        });

        const confirmedAlbum = await input({
          message: `Use Album: ${fullAlbum}`,
          default: fullAlbum,
        });

        metaData[path] = {
          fullArtist: confirmedArtist,
          fullAlbum: confirmedAlbum,
          genre: confirmedGenre,
        };
      }
    }

    const output = {
      fullArtist: metaData[path].fullArtist,
      fullAlbum: metaData[path].fullAlbum,
      genre: metaData[path].genre,
    };

    fs.writeFile(backupFile, JSON.stringify(output), () => {});

    return output;
  },

  writeBack: function () {
    fs.writeFileSync(metaFile, JSON.stringify(metaData));
  },
};

export default new getMeta();
