import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_TOOLS = fileURLToPath(new URL("../pkgs/", import.meta.url));
const TARGETS = ["darwin-arm64", "win32-x64"];
const require = createRequire(import.meta.url);

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

async function findLocalTool(fileName: string, platform: NodeJS.Platform, toolsDir: string, packageName: string) {
  const file = resolve(toolsDir, packageName, fileName);
  if (await isExecutable(file, platform)) return file;
}

async function findPlatformTool(fileName: string, platform: NodeJS.Platform, packageName: string) {
  try {
    const manifest = require.resolve(`${packageName}/package.json`);
    const file = resolve(dirname(manifest), fileName);
    if (await isExecutable(file, platform)) return file;
  } catch {
    // 平台包是可选依赖，未安装时继续查 PATH。
  }
}

async function findToolOnPATH(fileName: string, platform: NodeJS.Platform, path: string) {
  for (const dir of pathDirs(path, platform)) {
    const file = resolve(dir, fileName);
    // 跳过不存在或不可执行的候选文件。
    if (await isExecutable(file, platform)) return file;
  }
}

// 查找顺序：本地 pkgs → npm 平台包 → 环境变量 PATH。
export async function findTool(
  name: ToolName,
  { platform = process.platform, arch = process.arch, toolsDir = LOCAL_TOOLS, path = process.env.PATH ?? "" }: AudioToolLocation = {},
): Promise<string | undefined> {
  const fileName = platform === "win32" ? `${name}.exe` : name;
  const target = `${platform}-${arch}`;
  if (TARGETS.includes(target)) {
    const packageName = `pi-friday-${target}`;
    const file = (await findLocalTool(fileName, platform, toolsDir, packageName))
      ?? (await findPlatformTool(fileName, platform, packageName));
    if (file) return file;
  }
  return findToolOnPATH(fileName, platform, path);
}
