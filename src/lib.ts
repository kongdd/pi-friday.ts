import { spawn, type ChildProcess } from "node:child_process";

export type VoiceMode = "zh" | "en";
export type PlayerName = "afplay" | "audio-play" | (typeof PLAYERS)[number];
export type Player = { name: PlayerName; command: string };
export type SpeakCommand = {
  action: "speak" | "stop";
  text?: string;
  lang?: string;
  rate?: number;
};
export type StatusCtx = {
  hasUI: boolean;
  ui: {
    setStatus(key: string, text: string | undefined): void;
    notify(message: string, level: "info" | "warning" | "error"): void;
    setWidget?(key: string, lines: string[] | undefined): void;
  };
};

export const STATUS_KEY = "friday";
export const BROWSER_SPEECH_WIDGET = "friday-speech";
export const VOICES: Record<VoiceMode, string> = {
  zh: "zh-CN-XiaoxiaoNeural",
  en: "en-US-AriaNeural",
};
export const PLAYERS = ["ffplay", "mplayer"] as const;
export const DEFAULT_LOCAL_RECEIVER_URL = "http://127.0.0.1:17322/speak";
export const FRIDAY_CMDS = [
  "on", "on global", "on local", "off", "off global", "off local",
  "zh", "en", "speed", "test",
  "config --save-audio=yes", "config --save-audio=no",
] as const;

export const langFor = (m: VoiceMode) => (m === "zh" ? "zh-CN" : "en-US");

export function rateToEdgeTts(rate: number): string {
  const p = Math.round((rate - 1) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

export function isRemoteEnv(mode?: "local" | "remote"): boolean {
  // 持久化配置优先，避免继承的 SSH 环境变量触发远程播放。
  if (mode) return mode === "remote";
  // 环境变量仍可在未配置模式时显式指定本地播放。
  if (process.env.FRIDAY_REMOTE === "0") return false;
  return Boolean(
    process.env.FRIDAY_REMOTE === "1"
    || process.env.SSH_CONNECTION
    || (process.env.VSCODE_IPC_HOOK_CLI && process.env.WSL_DISTRO_NAME),
  );
}

export function waitForExit(proc: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    proc.once("error", () => resolve(null));
    proc.once("close", (code) => resolve(code));
  });
}

export function stopProc(proc: ChildProcess | undefined): void {
  if (proc && !proc.killed) proc.kill("SIGTERM");
}

export function playerArgs(program: PlayerName, file: string): string[] {
  if (program === "ffplay") return ["-nodisp", "-autoexit", "-loglevel", "error", file];
  if (program === "mplayer") return ["-really-quiet", file];
  return [file];
}

export const spawnQuiet = (cmd: string, args: string[]) => spawn(cmd, args, { stdio: "ignore", windowsHide: true });