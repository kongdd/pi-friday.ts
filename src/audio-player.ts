import { spawn, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { findBundledTool, isExecutable, type AudioToolLocation } from "./audio-tools";

const PLAYERS = ["ffplay", "mplayer"] as const;
type PlayerName = "afplay" | "audio-play" | (typeof PLAYERS)[number];
export type Player = { name: PlayerName; command: string };

export async function findPlayer(
  { platform = process.platform, path = process.env.PATH ?? "", ...location }: AudioToolLocation & { path?: string } = {},
): Promise<Player | undefined> {
  const bundled = await findBundledTool("audio-play", { platform, ...location });
  if (bundled) return { name: "audio-play", command: bundled };

  const windows = platform === "win32";
  const dirs = path.split(windows ? ";" : ":")
    .map((dir) => windows ? dir.replace(/^"(.*)"$/, "$1") : dir)
    .filter(Boolean);
  const players: PlayerName[] = ["audio-play"];
  if (platform === "darwin") players.push("afplay");
  players.push(...PLAYERS);

  for (const name of players) {
    for (const dir of dirs) {
      const command = resolve(dir, windows ? `${name}.exe` : name);
      // 跳过不存在或不可执行的候选文件。
      if (await isExecutable(command, platform)) return { name, command };
    }
  }
}

export function playerArgs(program: PlayerName, file: string): string[] {
  if (program === "ffplay") return ["-nodisp", "-autoexit", "-loglevel", "error", file];
  if (program === "mplayer") return ["-really-quiet", file];
  return [file];
}

function waitForExit(proc: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    proc.once("error", () => resolve(null));
    proc.once("close", (code) => resolve(code));
  });
}

export function stopProc(proc: ChildProcess | undefined): void {
  if (proc && !proc.killed) proc.kill("SIGTERM");
}

export async function playMp3File(player: Player, path: string, onSpawn?: (proc: ChildProcess) => void): Promise<void> {
  const proc = spawn(player.command, playerArgs(player.name, path), { stdio: "ignore", windowsHide: true });
  onSpawn?.(proc);
  await waitForExit(proc);
  await rm(path, { force: true }).catch(() => {});
}
