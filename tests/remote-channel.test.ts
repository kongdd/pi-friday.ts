import { expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createRemoteChannel } from "../src/playback";

test("远程播放通过 POST 发送音频并清理临时文件", async () => {
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  const url = "http://127.0.0.1:17322/play";
  let output: string | undefined;
  const pi = {
    async exec(_command: string, args: string[]) {
      output = args[args.indexOf("--write-media") + 1];
      await writeFile(output, "audio");
      return { code: 0 };
    },
  } as unknown as ExtensionAPI;

  try {
    const remote = createRemoteChannel({ pi, voice: () => "zh", rate: () => 1, receiverUrl: url, disableReceiver: false });
    const ctx = { hasUI: false, ui: { setStatus() {}, notify() {} } };
    expect(await remote.speak("你好", ctx)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ type: "mp3", data: Buffer.from("audio").toString("base64"), rate: 1 }),
    }));
    expect(existsSync(output!)).toBe(false);
  } finally {
    fetchMock.mockRestore();
  }
});
