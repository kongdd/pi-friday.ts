import { spawn, type ChildProcess } from "node:child_process";
import { findTool, type AudioToolLocation, type ToolName } from "./audio-tools";

const PLAYERS = ["ffplay", "mplayer"] as const;
export type PlayerName = Exclude<ToolName, "edge-tts-rust">;
export type Player = { name: PlayerName; command: string };

export async function findPlayer(location: AudioToolLocation = {}): Promise<Player | undefined> {
  const players: PlayerName[] = ["audio-play"];
  if ((location.platform ?? process.platform) === "darwin") players.push("afplay");
  players.push(...PLAYERS);

  for (const name of players) {
    const command = await findTool(name, location);
    if (command) return { name, command };
  }
}

export function playerArgs(program: PlayerName, file: string): string[] {
  if (program === "ffplay") return ["-nodisp", "-autoexit", "-loglevel", "error", file];
  if (program === "mplayer") return ["-really-quiet", file];
  return [file];
}

export function stopProc(proc: ChildProcess | undefined): void {
  if (proc && !proc.killed) proc.kill("SIGTERM");
}

export async function playMp3File(player: Player, path: string, onSpawn?: (proc: ChildProcess) => void): Promise<void> {
  const proc = spawn(player.command, playerArgs(player.name, path), {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  proc.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-1024);
  });
  onSpawn?.(proc);
  await new Promise<void>((resolve, reject) => {
    proc.once("error", reject);
    proc.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${player.name}：${stderr.trim() || `退出状态 ${code ?? signal}`}`));
    });
  });
}
