import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import {
  buildConfigMap,
  getConfig,
  loadConfig,
  type AppConfig,
  type ConfigKey,
} from "./config.js";
import { MetaGetter } from "./getMeta.js";
import {
  listCommandScripts,
  prepareCommandFolders,
  processEncoder,
} from "./processEncoder.js";
import { normalizeDir, normalizeTerminalOutput } from "./paths.js";
import { captureConsole, clearJobLogs, appendJobLog } from "./jobLog.js";
import { clearJobProgress, setJobProgress } from "./progress.js";
import { createAutoPrompts, createCliPrompts, type Prompts } from "./prompts.js";

export interface RunOptions {
  startFolder: string;
  encoderIds: ConfigKey[];
  filter: string;
  configPath?: string;
  prompts?: Prompts;
}

export interface RunResult {
  elapsedSeconds: number;
  scripts: string[];
}

export const initRuntime = (configPath?: string): AppConfig => {
  const absoluteConfigPath = configPath ? path.resolve(configPath) : undefined;
  const config = loadConfig(absoluteConfigPath);
  fs.mkdirSync(config.commandsFolder, { recursive: true });
  fs.mkdirSync(config.queueFolder, { recursive: true });
  process.chdir(config.workDir);
  return config;
};

export const runDowncoder = async (options: RunOptions): Promise<RunResult> => {
  const config = options.configPath
    ? initRuntime(options.configPath)
    : getConfig();
  const prompts = options.prompts ?? createCliPrompts();
  const normalizedStart = normalizeDir(options.startFolder);

  if (!fs.existsSync(normalizedStart)) {
    throw new Error(`Source folder does not exist: ${normalizedStart}`);
  }
  if (!fs.statSync(normalizedStart).isDirectory()) {
    throw new Error(`Source path is not a directory: ${normalizedStart}`);
  }

  const configMap = buildConfigMap(normalizedStart, options.encoderIds);
  const metaGetter = new MetaGetter(config, prompts);

  const start = Date.now();
  prepareCommandFolders(config);
  clearJobLogs();
  const restoreConsole = captureConsole();

  try {
    setJobProgress(`Scanning ${normalizedStart}...`);
    for (let i = 0; i < options.encoderIds.length; i++) {
      const key = options.encoderIds[i];
      setJobProgress(
        `Encoder ${i + 1}/${options.encoderIds.length} (${key}) — walking library...`
      );
      await processEncoder(
        key,
        normalizedStart,
        options.filter,
        config,
        configMap,
        metaGetter,
        prompts
      );
    }
    setJobProgress("Writing scripts...");
  } finally {
    restoreConsole();
    clearJobProgress();
  }

  return {
    elapsedSeconds: (Date.now() - start) / 1000,
    scripts: listCommandScripts(config),
  };
};

export const executeScript = (
  scriptPath: string,
  config: AppConfig = getConfig()
): Promise<{ code: number; output: string }> => {
  const restoreConsole = captureConsole();
  return new Promise((resolve, reject) => {
    const resolvedScriptPath = path.resolve(scriptPath);
    const filename = path.basename(resolvedScriptPath);
    const queuePath = path.join(config.queueFolder, filename);
    fs.mkdirSync(config.queueFolder, { recursive: true });

    try {
      fs.renameSync(resolvedScriptPath, queuePath);
    } catch (error) {
      reject(error);
      return;
    }

    const child = spawn("bash", [queuePath], {
      cwd: config.workDir,
      env: process.env,
    });

    let output = "";
    const logStream = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) {
          appendJobLog(trimmed);
        }
      }
    };
    child.stdout.on("data", logStream);
    child.stderr.on("data", logStream);
    child.on("error", (error) => {
      restoreConsole();
      try {
        fs.renameSync(queuePath, resolvedScriptPath);
      } catch {
        // ignore restore errors
      }
      reject(error);
    });
    child.on("close", (code) => {
      restoreConsole();
      try {
        fs.unlinkSync(queuePath);
      } catch {
        // ignore cleanup errors
      }
      resolve({ code: code ?? 1, output: normalizeTerminalOutput(output) });
    });
  });
};

export const executeAllScripts = async (
  scripts: string[],
  config: AppConfig = getConfig()
): Promise<{ code: number; output: string }> => {
  let combined = "";
  for (const script of scripts) {
    const result = await executeScript(script, config);
    combined += result.output;
    if (result.code !== 0) {
      return { code: result.code, output: combined };
    }
  }
  return { code: 0, output: combined };
};

export const runBatchShell = (config: AppConfig = getConfig()): void => {
  const batchPath = path.join(config.workDir, "batch.sh");
  if (fs.existsSync(batchPath)) {
    execSync("bash ./batch.sh", { stdio: "inherit", cwd: config.workDir });
    return;
  }

  const scripts = listCommandScripts(config);
  void executeAllScripts(scripts, config);
};

export { listCommandScripts, prepareCommandFolders, clearCommandScripts } from "./processEncoder.js";
export { createAutoPrompts, createCliPrompts };
