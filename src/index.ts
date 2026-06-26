#!/usr/bin/env node

const [command] = process.argv.slice(2);

if (command === "serve") {
  await import("./serve.js");
} else if (command === "clean-empty") {
  await import("./cleanEmptyFolders.js");
} else if (command === "sync-meta") {
  await import("./syncMetaFromLocal.js");
} else if (command === "repair-meta-years") {
  await import("./repairMetaYears.js");
} else {
  await import("./cli.js");
}

export {};
