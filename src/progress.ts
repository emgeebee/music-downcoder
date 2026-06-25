import { appendJobLog } from "./jobLog.js";

export interface JobProgress {
  busy: boolean;
  message: string;
}

let state: JobProgress = { busy: false, message: "" };

export const setJobProgress = (message: string): void => {
  state = { busy: true, message };
  appendJobLog(message);
};

export const clearJobProgress = (): void => {
  state = { busy: false, message: "" };
};

export const getJobProgress = (): JobProgress => ({ ...state });
