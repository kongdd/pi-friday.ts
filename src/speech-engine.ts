import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { hasEdgeTts, synthSavedMp3, type VoiceMode } from "./edge-tts";
import { projectName, savedAudioPath } from "./friday-config";
import { createLocalChannel, createRemoteChannel, createRpcChannel, type LocalSpeechPhase, type StatusCtx } from "./playback";

const STATUS_KEY = "friday";
const langFor = (voice: VoiceMode) => (voice === "zh" ? "zh-CN" : "en-US");

export function createSpeechEngine(
  pi: ExtensionAPI,
  opts: {
    isRemote: boolean;
    saveAudio: boolean;
    localReceiverUrl?: string;
    disableLocalReceiver: boolean;
  },
) {
  const state = { enabled: opts.isRemote, voiceMode: "zh" as VoiceMode, speechRate: 1, saveAudio: opts.saveAudio };
  let phase: LocalSpeechPhase = "idle";
  let warnedDisconnected = false;

  const remote = createRemoteChannel({
    pi,
    voice: () => state.voiceMode,
    rate: () => state.speechRate,
    receiverUrl: opts.localReceiverUrl,
    disableReceiver: opts.disableLocalReceiver,
  });
  const rpc = createRpcChannel();

  const renderStatus = (ctx: StatusCtx) => {
    if (!ctx.hasUI) return;
    if (!state.enabled) { ctx.ui.setStatus(STATUS_KEY, "○ Friday off"); return; }
    const speed = state.speechRate === 1 ? "" : ` ${state.speechRate}×`;
    const status = phase === "idle" ? `● Friday ${state.voiceMode}`
      : phase === "synthesizing" ? "◉ Friday to audio"
      : "◉ Friday speaking...";
    ctx.ui.setStatus(STATUS_KEY, `${status}${speed}`);
  };

  const local = createLocalChannel({
    pi,
    isEnabled: () => state.enabled,
    voice: () => state.voiceMode,
    rate: () => state.speechRate,
    onPhase: (next, ctx) => {
      phase = next;
      if (ctx) renderStatus(ctx);
    },
  });

  const deliverSpeech = async (text: string, ctx: ExtensionContext): Promise<boolean> => {
    const { voiceMode, speechRate, saveAudio } = state;
    const project = projectName(ctx.cwd);
    const spokenText = voiceMode === "zh"
      ? `Project ${project}。${text}`
      : `Project ${project}. ${text}`;
    const saveTo = saveAudio
      ? savedAudioPath(ctx.cwd, ctx.sessionManager.getSessionId())
      : undefined;
    if (opts.isRemote) {
      const delivered = await remote.speak(spokenText, ctx, saveTo);
      if (!delivered && !warnedDisconnected) {
        ctx.ui.notify("Friday 远程播放失败：未能将音频发送给接收器。", "warning");
      }
      warnedDisconnected = !delivered;
      return delivered;
    }
    if (ctx.mode === "rpc") {
      if (saveTo) {
        try {
          if (!await synthSavedMp3(pi, spokenText, voiceMode, speechRate, saveTo)) {
            ctx.ui.notify("Friday 音频保存失败：edge-tts-rust 合成失败。", "warning");
          }
        } catch (error) {
          ctx.ui.notify(`Friday 音频保存失败：${error instanceof Error ? error.message : String(error)}`, "warning");
        }
      }
      rpc.emit(ctx, { action: "speak", text: spokenText, lang: langFor(state.voiceMode), rate: state.speechRate });
      return true;
    }
    local.enqueue(spokenText, ctx, saveTo);
    return true;
  };

  const stopSpeech = (ctx: ExtensionContext) => {
    local.stop();
    if (ctx.mode === "rpc") rpc.emit(ctx, { action: "stop" });
  };

  const turnOn = async (ctx: ExtensionContext) => {
    warnedDisconnected = false;
    let message: string;
    if (opts.isRemote) {
      if (!await hasEdgeTts(pi)) {
        ctx.ui.notify("Friday 无法开启：未找到 edge-tts-rust。", "error");
        return;
      }
      message = "Friday 已开启：远程 17322 接收器。";
    } else if (ctx.mode === "rpc") {
      message = "Friday 已开启：RPC 浏览器语音。";
    } else {
      const [ok, p] = await Promise.all([hasEdgeTts(pi), local.preparePlayer()]);
      if (!ok || !p) {
        const missingPlayer = process.platform === "win32"
          ? "未找到播放器，请将 audio-play.exe 所在目录加入 PATH"
          : "未找到可用的音频播放器";
        ctx.ui.notify(`Friday 无法开启：${[!ok && "未找到 edge-tts-rust", !p && missingPlayer].filter(Boolean).join("；")}`, "error");
        return;
      }
      message = `Friday 已开启：本地播放器 ${p.name}。`;
    }
    state.enabled = true;
    renderStatus(ctx);
    ctx.ui.notify(message, "info");
  };

  return {
    state,
    renderStatus,
    deliverSpeech,
    turnOn,
    turnOff(ctx: ExtensionContext) {
      state.enabled = false;
      stopSpeech(ctx);
      renderStatus(ctx);
      ctx.ui.notify("Friday 已关闭。", "info");
    },
    shutdown(ctx: ExtensionContext) {
      stopSpeech(ctx);
      ctx.ui.setStatus(STATUS_KEY, undefined);
    },
  };
}