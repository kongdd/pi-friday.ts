import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createLocalChannel, type LocalSpeechPhase, type StatusCtx } from "../src/playback";

test.skipIf(process.platform === "win32")("stopping a drain prevents stale UI access and discards its queue", async () => {
  const dir = await mkdtemp(join(tmpdir(), "friday-channel-"));
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const synthesized: string[] = [];
  const phases: LocalSpeechPhase[] = [];
  let oldMp3 = "";
  let oldCtxReads = 0;
  let stale = false;
  const ui = { setStatus() {}, notify() {} };
  const oldCtx: StatusCtx = {
    get hasUI() {
      oldCtxReads++;
      if (stale) throw new Error("stale context");
      return true;
    },
    ui,
  };
  const pi = {
    async exec(_command: string, [text, , output]: string[]) {
      synthesized.push(text);
      if (text === "--text=old") {
        oldMp3 = output;
        started.resolve();
        await release.promise;
      }
      await writeFile(output, text);
      return { code: 0 };
    },
  } as unknown as ExtensionAPI;
  const channel = createLocalChannel({
    pi,
    isEnabled: () => true,
    voice: () => "zh",
    rate: () => 1,
    onPhase(phase, ctx) {
      phases.push(phase);
      if (ctx?.hasUI) ctx.ui.setStatus("friday", phase);
    },
  });

  let stopped: Promise<void> | undefined;
  try {
    const command = join(dir, "audio-play");
    await writeFile(command, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    await channel.preparePlayer(async () => ({ name: "audio-play", command }));

    const oldArchive = join(dir, "old.mp3");
    stopped = channel.enqueue("old", oldCtx, oldArchive);
    await started.promise;
    channel.enqueue("discard", oldCtx);
    channel.stop(); // also called by session_shutdown before the context becomes stale
    stale = true;

    const nextArchive = join(dir, "next.mp3");
    const next = channel.enqueue("next", { hasUI: true, ui }, nextArchive);
    expect(phases).toEqual(["synthesizing", "idle", "synthesizing"]);
    release.resolve();
    await Promise.all([stopped, next]);

    expect(synthesized).toEqual(["--text=old", "--text=next"]);

    expect(phases).toEqual(["synthesizing", "idle", "synthesizing", "speaking", "idle"]);
    expect(oldCtxReads).toBe(1);
    expect(await Bun.file(oldMp3).exists()).toBe(false);
    expect(await Bun.file(oldArchive).exists()).toBe(false);
    expect(await readFile(nextArchive, "utf8")).toBe("--text=next");
  } finally {
    release.resolve();
    await stopped;
    channel.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32")("reports a player failure and removes the temporary audio", async () => {
  const dir = await mkdtemp(join(tmpdir(), "friday-channel-"));
  const messages: string[] = [];
  let mp3 = "";
  const channel = createLocalChannel({
    pi: {
      async exec(_command: string, [, , output]: string[]) {
        mp3 = output;
        await writeFile(output, "audio");
        return { code: 0 };
      },
    } as unknown as ExtensionAPI,
    isEnabled: () => true,
    voice: () => "zh",
    rate: () => 1,
    onPhase() {},
  });
  try {
    const command = join(dir, "audio-play");
    await writeFile(command, "#!/bin/sh\necho 'no output device' >&2\nexit 1\n", { mode: 0o755 });
    await channel.preparePlayer(async () => ({ name: "audio-play", command }));
    await channel.enqueue("test", {
      hasUI: true,
      ui: { setStatus() {}, notify: (message) => messages.push(message) },
    });
    expect(messages).toEqual(["Friday 本地播放失败：audio-play：no output device"]);
    expect(await Bun.file(mp3).exists()).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
