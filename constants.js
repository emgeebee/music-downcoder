"use strict";

const start = "/Volumes/Itunes/Music/Music/";

export const rate = "0";
export const commandsFolder = "./cmd/";
export const numOfCores = 4;
export const config = {
  main: {
    start,
    out: "/Volumes/Music/cds-mp3/",
    format: "mp3",
  },
  ogg: {
    start,
    out: "/Volumes/Music/cds-ogg/",
    format: "ogg",
    getImages: false,
  },
  alac: {
    start,
    out: "/Volumes/Music/cds-alac/",
    format: "cp",
    getImages: false,
  },
  local: {
    start: "/Users/mat/Music/Phile Audio/audio2/",
    out: "/Users/mat/Music/" + rate + "/",
  },
  localitunes: {
    start: "/Users/mat/Music/ripping library/iTunes Media/Music/",
    out: "/Users/mat/Music/" + rate + "/",
  },
};
