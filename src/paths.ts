import path from "path";

/** Normalize a directory path (resolve, no trailing slash). */
export const normalizeDir = (dirPath: string): string => {
  const normalized = path.normalize(dirPath);
  return normalized.replace(/[/\\]+$/, "") || normalized;
};

/** Resolve a config value relative to the config file directory when not absolute. */
export const resolveConfigPath = (
  configDir: string,
  value: string
): string => normalizeDir(
  path.isAbsolute(value) ? value : path.resolve(configDir, value)
);

/** Strip a base directory from a path safely (unlike string .replace). */
export const relativeFrom = (baseDir: string, fullPath: string): string => {
  const rel = path.relative(normalizeDir(baseDir), fullPath);
  if (rel.startsWith("..")) {
    throw new Error(
      `Path "${fullPath}" is outside base directory "${baseDir}"`
    );
  }
  return rel;
};

/** Collapse in-place terminal progress (\\r overwrites) into readable lines. */
export const normalizeTerminalOutput = (output: string): string =>
  output
    .split("\n")
    .map((line) => line.split("\r").pop() ?? line)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Join path segments for ffmpeg shell commands (always POSIX-style slashes). */
export const shellPath = (...segments: string[]): string =>
  path.join(...segments).replace(/\\/g, "/");

/** Quote a path for use in generated bash scripts. */
export const shellQuote = (value: string): string =>
  `"${value.replace(/\\/g, "/").replace(/"/g, '\\"')}"`;
