export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

const MAX_LOGS = 500;
let nextId = 1;
let entries: LogEntry[] = [];

export const clearJobLogs = (): void => {
  entries = [];
};

export const appendJobLog = (
  message: string,
  level: LogLevel = "info"
): void => {
  const line = message.trim();
  if (!line) {
    return;
  }
  entries.push({
    id: nextId++,
    time: new Date().toISOString(),
    level,
    message: line,
  });
  if (entries.length > MAX_LOGS) {
    entries = entries.slice(-MAX_LOGS);
  }
};

export const getJobLogs = (since = 0): LogEntry[] =>
  entries.filter((entry) => entry.id > since);

const formatArgs = (args: unknown[]): string =>
  args
    .map((arg) =>
      typeof arg === "string" ? arg : JSON.stringify(arg, undefined, 2)
    )
    .join(" ");

export const captureConsole = (): (() => void) => {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args: unknown[]) => {
    appendJobLog(formatArgs(args), "info");
    original.log(...args);
  };
  console.warn = (...args: unknown[]) => {
    appendJobLog(formatArgs(args), "warn");
    original.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    appendJobLog(formatArgs(args), "error");
    original.error(...args);
  };

  return () => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  };
};
