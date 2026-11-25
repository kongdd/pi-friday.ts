import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPlayer, playerArgs } from "../src/audio-player";
import { findTool } from "../src/audio-tools";

test.each([
  ["win32", ["ffplay.exe", "audio-play.exe"], "audio-play.exe", "audio-play"],
  ["win32", ["ffplay.exe"], "ffplay.exe", "ffplay"],
  ["darwin", ["audio-play", "afplay"], "audio-play", "audio-play"],
  ["darwin", ["afplay", "ffplay"], "afplay", "afplay"],
  ["linux", ["audio-play", "ffplay"], "audio-play", "audio-play"],
] as const)("finds the preferred player on %s with %j on PATH", async (platform, files, exe, name) => {
  const root = await mkdtemp(join(tmpdir(), "friday-player-"));
  try {
    const bin = join(root, "音频 工具");
    await mkdir(bin);
    for (const file of files) await writeFile(join(bin, file), "", { mode: 0o755 });

    const path = platform === "win32" ? `${root};"${bin}"` : `${root}:${bin}`;
    const location = { platform, arch: platform === "darwin" ? "arm64" : "x64", toolsDir: root } as const;
    expect(await findPlayer({ ...location, path })).toEqual({ name, command: join(bin, exe) });
    expect(await findPlayer({ ...location, path: root })).toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  ["darwin", "arm64", "pi-friday-mac", ""],
  ["win32", "x64", "pi-friday-windows", ".exe"],
] as const)("uses local platform packages on %s-%s", async (platform, arch, packageName, suffix) => {
  const toolsDir = await mkdtemp(join(tmpdir(), "friday-tools-"));
  try {
    const bin = join(toolsDir, packageName);
    await mkdir(bin);
    const player = join(bin, `audio-play${suffix}`);
    const tts = join(bin, `edge-tts-rust${suffix}`);
    for (const file of [player, tts, join(toolsDir, `audio-play${suffix}`)]) {
      await writeFile(file, "", { mode: 0o755 });
    }

    const location = { platform, arch, toolsDir };
    expect(await findPlayer({ ...location, path: toolsDir })).toEqual({ name: "audio-play", command: player });
    expect(await findTool("edge-tts-rust", location)).toBe(tts);
    // 不支持的架构不看包内目录，改从 PATH 查找同名程序。
    expect(await findTool("edge-tts-rust", { ...location, arch: "ia32", path: "" })).toBeUndefined();
    expect(await findTool("edge-tts-rust", { ...location, arch: "ia32", path: bin })).toBe(tts);
  } finally {
    await rm(toolsDir, { recursive: true, force: true });
  }
});

test.each([
  ["darwin", "arm64", "pi-friday-mac", "audio-play"],
  ["win32", "x64", "pi-friday-windows", "audio-play.exe"],
] as const)("finds %s-%s tools in the %s npm package", async (platform, arch, packageName, fileName) => {
  const root = await mkdtemp(join(tmpdir(), "friday-npm-tools-"));
  try {
    const bin = join(root, "node_modules", packageName);
    const player = join(bin, fileName);
    const module = join(root, "audio-tools.ts");
    await mkdir(bin, { recursive: true });
    await writeFile(join(bin, "package.json"), JSON.stringify({ name: packageName }));
    await writeFile(player, "", { mode: 0o755 });
    await copyFile(new URL("../src/audio-tools.ts", import.meta.url), module);

    const { findTool } = await import(module);
    const location = { platform, arch, toolsDir: root, path: "" };
    const found = await findTool("audio-play", location);
    expect(found && await realpath(found)).toBe(await realpath(player));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("lightweight players take the MP3 path as a single argument", () => {
  const file = "示例 音频.mp3";
  expect(playerArgs("audio-play", file)).toEqual([file]);
  expect(playerArgs("afplay", file)).toEqual([file]);
});
