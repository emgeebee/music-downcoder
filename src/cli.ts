#!/usr/bin/env node

import path from "path";
import { checkbox, input, select } from "@inquirer/prompts";
import { getConfig, loadConfig } from "./config.js";
import {
  createCliPrompts,
  initRuntime,
  runBatchShell,
  runDowncoder,
} from "./run.js";

const configArgIndex = process.argv.indexOf("-c");
const configPath =
  configArgIndex >= 0
    ? path.resolve(process.argv[configArgIndex + 1])
    : undefined;

if (configPath) {
  initRuntime(configPath);
} else {
  loadConfig();
}

const config = getConfig();

const startFolder = await select<string>({
  message: "Select start folder",
  choices: config.startFolders.map((folder) => ({
    name: folder.name,
    value: folder.path,
  })),
});

const configKeys = await checkbox<string>({
  message: "Select encoder",
  choices: config.encoders.map((encoder) => ({
    name: encoder.label,
    value: encoder.id,
    description: encoder.description,
    checked: encoder.default ?? false,
  })),
});

const filter = await input({
  message: "Do you want to filter artists? Enter the start of the name",
  default: "",
});

const result = await runDowncoder({
  startFolder,
  encoderIds: configKeys,
  filter,
  configPath,
  prompts: createCliPrompts(),
});

console.log(`Time to run: ${result.elapsedSeconds}s`);

if (result.scripts.length === 0) {
  console.log("no commands to run");
  process.exit(0);
}

console.log("commands to run: ", result.scripts.join(", "));

const run = await select<boolean>({
  message: "Run commands?",
  choices: [
    { value: true, name: "Yes" },
    { value: false, name: "No" },
  ],
});

if (run) {
  runBatchShell();
}
