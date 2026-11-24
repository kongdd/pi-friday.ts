import { readFile, rm } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { findPlayer, playMp3File, stopProc, type Player } from "./audio-player";
import { archiveMp3, synthMp3, type VoiceMode } from "./edge-tts";

export type StatusCtx = {
  hasUI: boolean;
  ui: {
    setStatus(key: string, text: string | undefined): void;
    notify(message: string, level: "info" | "warning" | "error"): void;
    setWidget?(key: string, lines: string[] | undefined): void;
  };
};

type SpeakCommand = {
  action: "speak" | "stop";
  text?: string;
  lang?: string;
  rate?: number;
};

const BROWSER_SPEECH_WIDGET = "friday-speech";
const DEFAULT_LOCAL_RECEIVER_URL = "http://127.0.0.1:17322/speak";

async function saveAudioCopy(
  path: string,
  destination: string | undefined,
  ctx: StatusCtx,
  isCurrent?: () => boolean,
): Promise<void> {
  if (!destination) return;
  try { await archiveMp3(path, destination); }
  catch (error) {
    if (isCurrent && !isCurrent()) return;
    ctx.ui.notify(`Friday 音频保存失败：${error instanceof Error ? error.message : String(error)}`, "warning");
  }
}

// —— 本地播放队列 ——
export type LocalSpeechPhase = "idle" | "synthesizing" | "speaking";

export function createLocalChannel(deps: {
  pi: ExtensionAPI;
  isEnabled: () => boolean;
  voice: () => VoiceMode;
  rate: () => number;
  onPhase: (phase: LocalSpeechPhase, ctx?: StatusCtx) => void;
}) {
  let player: Player | undefined;
  let current: import("node:child_process").ChildProcess | undefined;
  let queue: Array<{ text: string; saveTo?: string }> = [];
  let drain: symbol | undefined;

  const stop = () => {
    drain = undefined;
    queue = [];
    stopProc(current);
    current = undefined;
    deps.onPhase("idle");
  };

  const enqueue = (text: string, ctx: StatusCtx, saveTo?: string) => {
    queue.push({ text, saveTo });
    if (drain) return;
    const token = drain = Symbol();
    // Shutdown and /friday off invalidate this worker before it can resume.
    const isCurrent = () => drain === token;

    return (async () => {
      try {
        while (isCurrent() && deps.isEnabled() && queue.length) {
          const next = queue.shift();
          if (!next || !player) continue;
          let path: string | undefined;
          try {
            deps.onPhase("synthesizing", ctx);
            path = await synthMp3(deps.pi, next.text, deps.voice(), deps.rate(), "local");
            if (!isCurrent()) continue;
            if (!path) throw new Error("edge-tts-rust 合成失败");
            await saveAudioCopy(path, next.saveTo, ctx, isCurrent);
            if (isCurrent() && deps.isEnabled()) {
              deps.onPhase("speaking", ctx);
              await playMp3File(player, path, (p) => { current = p; });
            }
          } catch (error) {
            if (isCurrent()) {
              ctx.ui.notify(`Friday 本地播放失败：${error instanceof Error ? error.message : String(error)}`, "error");
            }
          } finally {
            if (path) await rm(path, { force: true }).catch(() => {});
            if (isCurrent()) current = undefined;
          }
        }
      } finally {
        if (isCurrent()) {
          drain = undefined;
          deps.onPhase("idle", ctx);
        }
      }
    })().catch((error) => { console.error("Friday 本地播放失败：", error); });
  };

  const preparePlayer = async (discover = findPlayer) => { player = await discover(); return player; };

  return { stop, enqueue, preparePlayer };
}

// —— Remote：POST receiver ——
export function createRemoteChannel(deps: {
  pi: ExtensionAPI;
  voice: () => VoiceMode;
  rate: () => number;
  receiverUrl?: string;
  disableReceiver: boolean;
}) {
  const postReceiver = async (url: string, body: string) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      return (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ac.signal })).ok;
    } catch { return false; } finally { clearTimeout(t); }
  };

  const speak = async (
    text: string,
    ctx: StatusCtx,
    saveTo?: string,
  ): Promise<boolean> => {
    const path = await synthMp3(deps.pi, text, deps.voice(), deps.rate(), "remote");
    if (!path) return false;
    try {
      await saveAudioCopy(path, saveTo, ctx);
      if (deps.disableReceiver) return false;
      const data = (await readFile(path)).toString("base64");
      const payload = JSON.stringify({ type: "mp3", data, rate: deps.rate() });
      return await postReceiver(deps.receiverUrl ?? DEFAULT_LOCAL_RECEIVER_URL, payload);
    } finally {
      await rm(path, { force: true }).catch(() => {});
    }
  };

  return { speak };
}

// —— RPC widget ——
export function createRpcChannel() {
  let id = 0;
  return {
    emit(ctx: StatusCtx, command: SpeakCommand) {
      ctx.ui.setWidget?.(BROWSER_SPEECH_WIDGET, [JSON.stringify({ id: ++id, ...command })]);
    },
  };
}