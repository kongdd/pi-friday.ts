import { copyFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type VoiceMode = "zh" | "en";
export const VOICES: Record<VoiceMode, string> = {
  zh: "zh-CN-XiaoxiaoNeural",
  en: "en-US-AriaNeural",
};

const EDGE_TTS = "edge-tts-rust";

export function rateToEdgeTts(rate: number): string {
  const p = Math.round((rate - 1) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

function edgeArgs(text: string, output: string, voice: VoiceMode, rate: number): string[] {
  return [
    `--text=${text}`, "--write-media", output, "--voice", VOICES[voice],
    `--rate=${rateToEdgeTts(rate)}`, "--output-format", "audio-24khz-48kbitrate-mono-mp3",
  ];
}

export async function hasEdgeTts(pi: ExtensionAPI): Promise<boolean> {
  return (await pi.exec(EDGE_TTS, ["--version"], { timeout: 5000 })).code === 0;
}

export async function synthMp3(pi: ExtensionAPI, text: string, voice: VoiceMode, rate: number, tag: string): Promise<string | undefined> {
  const output = join(tmpdir(), `friday-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  if ((await pi.exec(EDGE_TTS, edgeArgs(text, output, voice, rate), { timeout: 60000 })).code !== 0) {
    await rm(output, { force: true }).catch(() => {});
    return undefined;
  }
  return output;
}

export async function archiveMp3(path: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(path, destination);
}

export async function synthSavedMp3(
  pi: ExtensionAPI,
  text: string,
  voice: VoiceMode,
  rate: number,
  destination: string,
): Promise<boolean> {
  const path = await synthMp3(pi, text, voice, rate, "saved");
  if (!path) return false;
  try {
    await archiveMp3(path, destination);
    return true;
  } finally {
    await rm(path, { force: true }).catch(() => {});
  }
}
