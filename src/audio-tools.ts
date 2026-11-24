import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLED_TOOLS = fileURLToPath(new URL("../dist/audio-tools/", import.meta.url));
const TARGETS = ["darwin-arm64", "win32-x64"];

export type ToolName = "audio-play" | "edge-tts-rust" | "afplay" | "ffplay" | "mplayer";

export type AudioToolLocation = {
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  toolsDir?: string;
  path?: string;
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

// PATH 以分号（Windows）或冒号分隔；Windows 允许整项带引号。
const pathDirs = (path: string, platform: NodeJS.Platform) =>
  path.split(platform === "win32" ? ";" : ":")
    .map((dir) => platform === "win32" ? dir.replace(/^"(.*)"$/, "$1") : dir)
    .filter(Boolean);

async function findBundledTool(fileName: string, platform: NodeJS.Platform, arch: NodeJS.Architecture, toolsDir: string) {
  const target = `${platform}-${arch}`;
  if (!TARGETS.includes(target)) return;
  const file = resolve(toolsDir, target, fileName);
  if (await isExecutable(file, platform)) return file;
}

async function findToolOnPATH(fileName: string, platform: NodeJS.Platform, path: string) {
  for (const dir of pathDirs(path, platform)) {
    const file = resolve(dir, fileName);
    // 跳过不存在或不可执行的候选文件。
    if (await isExecutable(file, platform)) return file;
  }
}

// find exe：先找包内 toolsDir/<platform>-<arch>，再找环境变量 PATH 中的同名程序。
export async function findTool(
  name: ToolName,
  { platform = process.platform, arch = process.arch, toolsDir = BUNDLED_TOOLS, path = process.env.PATH ?? "" }: AudioToolLocation = {},
): Promise<string | undefined> {
  const fileName = platform === "win32" ? `${name}.exe` : name;
  return (await findBundledTool(fileName, platform, arch, toolsDir))
    ?? findToolOnPATH(fileName, platform, path);
}
