import { input, select } from "@inquirer/prompts";
import type { AppConfig } from "./config.js";

export interface Prompts {
  confirm(message: string, defaultYes?: boolean): Promise<boolean>;
  input(message: string, defaultValue?: string): Promise<string>;
  select<T>(message: string, choices: { name: string; value: T }[]): Promise<T>;
}

export const createCliPrompts = (): Prompts => ({
  confirm: (message, defaultYes = true) =>
    select<boolean>({
      message,
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
      default: defaultYes,
    }),
  input: (message, defaultValue = "") =>
    input({ message, default: defaultValue }),
  select: <T>(message: string, choices: { name: string; value: T }[]) =>
    select<T>({ message, choices }),
});

export const createAutoPrompts = (config: AppConfig): Prompts => ({
  confirm: async () => config.autoConfirm,
  input: async (_message: string, defaultValue = "") => defaultValue,
  select: async <T>(_message: string, choices: { name: string; value: T }[]) =>
    choices[0]?.value as T,
});
