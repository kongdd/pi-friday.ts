import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLED_TOOLS = fileURLToPath(new URL("../dist/audio-tools/", import.meta.url));

export type AudioToolLocation = {
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  toolsDir?: string;
};

export async function isExecutable(file: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    if (!(await stat(file)).isFile()) return false;
    if (platform !== "win32") await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findBundledTool(
  name: "audio-play" | "edge-tts-rust",
  { platform = process.platform, arch = process.arch, toolsDir = BUNDLED_TOOLS }: AudioToolLocation = {},
): Promise<string | undefined> {
  const target = `${platform}-${arch}`;
  if (target !== "darwin-arm64" && target !== "win32-x64") return;
  const file = join(toolsDir, target, platform === "win32" ? `${name}.exe` : name);
  if (await isExecutable(file, platform)) return file;
}
