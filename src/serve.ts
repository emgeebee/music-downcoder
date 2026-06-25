#!/usr/bin/env node

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import { getConfig, loadConfig } from "./config.js";
import {
  createAutoPrompts,
  clearCommandScripts,
  executeAllScripts,
  executeScript,
  initRuntime,
  listCommandScripts,
  runDowncoder,
  type RunResult,
} from "./run.js";
import { describeScripts } from "./scripts.js";
import { getJobProgress } from "./progress.js";
import { appendJobLog, getJobLogs } from "./jobLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = minimist(process.argv.slice(2), {
  string: ["H", "p", "c"],
  alias: { H: "host", p: "port", c: "config" },
  default: { H: "0.0.0.0", p: "3798" },
});

const configPath = args.config
  ? path.resolve(args.config as string)
  : undefined;
if (!configPath) {
  console.error("serve requires -c /path/to/conf.json");
  process.exit(1);
}

initRuntime(configPath);
const config = getConfig();
const prompts = createAutoPrompts(config);

for (const folder of config.startFolders) {
  if (!fs.existsSync(folder.path)) {
    appendJobLog(
      `WARNING: source folder missing: ${folder.path} (${folder.name})`,
      "warn"
    );
  }
}

const port = Number(args.port);
const host = args.host as string;

const toScriptResponse = (scriptPaths: string[]) =>
  describeScripts(scriptPaths, config);

let runningJob: Promise<RunResult | { code: number; output: string }> | null = null;
let lastScripts: string[] = [];

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

const sendJson = (
  res: http.ServerResponse,
  status: number,
  payload: unknown
): void => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const htmlPath = path.join(__dirname, "web", "index.html");
const pageHtml = fs.readFileSync(htmlPath, "utf-8");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(pageHtml);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, {
      startFolders: config.startFolders,
      encoders: config.encoders,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/scripts") {
    lastScripts = listCommandScripts(config);
    sendJson(res, 200, toScriptResponse(lastScripts));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/logs") {
    const since = Number(url.searchParams.get("since") ?? "0");
    sendJson(res, 200, { entries: getJobLogs(since) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    const progress = getJobProgress();
    sendJson(res, 200, {
      busy: runningJob !== null,
      message: progress.message,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/run") {
    if (runningJob) {
      sendJson(res, 409, { error: "A job is already running" });
      return;
    }

    const body = JSON.parse(await readBody(req)) as {
      startFolder: string;
      encoderIds: string[];
      filter?: string;
    };

    try {
      runningJob = runDowncoder({
        startFolder: body.startFolder,
        encoderIds: body.encoderIds,
        filter: body.filter ?? "",
        configPath,
        prompts,
      })
        .then((result) => {
          lastScripts = result.scripts;
          return result;
        })
        .finally(() => {
          runningJob = null;
        });

      const result = (await runningJob) as RunResult;
      sendJson(res, 200, {
        ...result,
        scripts: toScriptResponse(result.scripts),
      });
    } catch (error) {
      runningJob = null;
      const message = error instanceof Error ? error.message : String(error);
      appendJobLog(`Scan failed: ${message}`, "error");
      sendJson(res, 500, { error: message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/scripts/clear") {
    if (runningJob) {
      sendJson(res, 409, { error: "A job is already running" });
      return;
    }

    const cleared = clearCommandScripts(config);
    lastScripts = [];
    sendJson(res, 200, { cleared });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/scripts/run") {
    if (runningJob) {
      sendJson(res, 409, { error: "A job is already running" });
      return;
    }

    const body = JSON.parse(await readBody(req)) as { path?: string; all?: boolean };
    try {
      runningJob = (async () => {
        if (body.all) {
          const scripts = listCommandScripts(config);
          return executeAllScripts(scripts, config);
        }
        if (!body.path) {
          throw new Error("path is required");
        }
        return executeScript(body.path, config);
      })().finally(() => {
        runningJob = null;
      });

      const result = await runningJob;
      lastScripts = listCommandScripts(config);
      sendJson(res, 200, {
        ...result,
        scripts: toScriptResponse(lastScripts),
      });
    } catch (error) {
      runningJob = null;
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, host, () => {
  appendJobLog(
    `Web UI at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`
  );
  appendJobLog(`Config: ${configPath}`);
  console.log(
    `[music_downcoder] web UI at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`
  );
  console.log(`[music_downcoder] config: ${configPath}`);
});
