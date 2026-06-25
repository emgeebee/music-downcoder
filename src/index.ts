#!/usr/bin/env node

const [command] = process.argv.slice(2);

if (command === "serve") {
  await import("./serve.js");
} else {
  await import("./cli.js");
}

export {};
