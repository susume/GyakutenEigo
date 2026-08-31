import assert from "node:assert/strict";
import test from "node:test";

test("speakingApi sends the dedicated participant token header for every protected operation", async () => {
  const runtime = globalThis as typeof globalThis & {
    window?: { location: { origin: string } };
    localStorage?: { getItem: (key: string) => string | null };
  };
  const originalFetch = globalThis.fetch;
  const originalWindow = runtime.window;
  const originalStorage = runtime.localStorage;
  const requests: Array<{ init?: RequestInit }> = [];
  runtime.window = { location: { origin: "http://speaking.test" } };
  runtime.localStorage = { getItem: () => null };
  globalThis.fetch = async (_input, init) => {
    requests.push({ init });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const { speakingApi } = await import("./client.js");
    await speakingApi.session("session-1", "participant-token");
    await speakingApi.turn("session-1", "participant-token", { text: "Hello", requestId: "turn-1" });
    await speakingApi.turn("session-1", "participant-token", { audio: new Blob(["audio"], { type: "audio/webm" }), requestId: "turn-2", speechDetected: false });
    await speakingApi.help("session-1", "participant-token");
    await speakingApi.finish("session-1", "participant-token");
    await speakingApi.result("participant-1", "participant-token");

    assert.equal(requests.length, 6);
    for (const request of requests) {
      const headers = new Headers(request.init?.headers);
      assert.equal(headers.get("X-Speaking-Token"), "participant-token");
      assert.equal(headers.has("X-Player-Token"), false);
    }
    const audioRequest = requests[2]!.init!;
    assert.equal(new Headers(audioRequest.headers).get("Content-Type"), "audio/webm");
    assert.equal(new Headers(audioRequest.headers).get("X-Speaking-Audio-Activity"), "false");
    assert.equal(audioRequest.body instanceof Blob, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete runtime.window;
    else runtime.window = originalWindow;
    if (originalStorage === undefined) delete runtime.localStorage;
    else runtime.localStorage = originalStorage;
  }
});
