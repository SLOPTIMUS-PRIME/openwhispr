const test = require("node:test");
const assert = require("node:assert/strict");
const { transcribeWithOpenRouter } = require("../../src/helpers/openrouterTranscription");

const AUDIO = Buffer.from("fake-audio-bytes");
const API_KEY = "sk-or-test-key";

function makeFetch(response) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => JSON.stringify(response),
      headers: new Map(),
    };
  };
  return { fetchImpl, calls };
}

function requestBody(calls) {
  return JSON.parse(calls[0].init.body);
}

test("posts raw base64 JSON to the dedicated transcription endpoint with Bearer auth", async () => {
  const { fetchImpl, calls } = makeFetch({ text: "hello" });

  const result = await transcribeWithOpenRouter(
    {
      audioBuffer: AUDIO,
      model: "vendor/example:nitro",
      contentType: "audio/webm",
      apiKey: API_KEY,
    },
    fetchImpl
  );

  assert.equal(calls[0].url, "https://openrouter.ai/api/v1/audio/transcriptions");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${API_KEY}`);
  const body = requestBody(calls);
  assert.equal(
    body.model,
    "vendor/example:nitro",
    "the full id, suffix included, is sent verbatim"
  );
  assert.deepEqual(body.input_audio, { data: AUDIO.toString("base64"), format: "webm" });
  assert.equal(body.response_format, "json", "text/srt/vtt are rejected by the endpoint");
  assert.deepEqual(
    body.provider,
    { data_collection: "deny" },
    "the no-training constraint is explicit"
  );
  assert.equal("prompt" in body, false, "the endpoint ignores a multipart prompt");
  assert.equal("file" in body, false, "multipart upload is not the transport");
  assert.equal(result.text, "hello");
  assert.equal(result.model, "vendor/example:nitro");
});

test("audio container mime types map onto documented input formats", async () => {
  const cases = [
    ["audio/webm", "webm"],
    ["audio/mpeg", "mp3"],
    ["audio/mp3", "mp3"],
    ["audio/wav", "wav"],
    ["audio/x-wav", "wav"],
    ["audio/flac", "flac"],
    ["audio/mp4", "m4a"],
    ["audio/m4a", "m4a"],
    ["audio/ogg", "ogg"],
    ["audio/aac", "aac"],
    [undefined, "webm"],
  ];
  for (const [contentType, format] of cases) {
    const { fetchImpl, calls } = makeFetch({ text: "ok" });
    await transcribeWithOpenRouter(
      { audioBuffer: AUDIO, model: "m/v", contentType, apiKey: API_KEY },
      fetchImpl
    );
    assert.equal(requestBody(calls).input_audio.format, format, contentType || "no type");
  }
});

test("a concrete language is forwarded; auto-detection stays server-side", async () => {
  const { fetchImpl, calls } = makeFetch({ text: "ok" });
  await transcribeWithOpenRouter(
    {
      audioBuffer: AUDIO,
      model: "m/v",
      contentType: "audio/webm",
      language: "de",
      apiKey: API_KEY,
    },
    fetchImpl
  );
  assert.equal(requestBody(calls).language, "de");

  for (const language of [undefined, "auto"]) {
    const again = makeFetch({ text: "ok" });
    await transcribeWithOpenRouter(
      { audioBuffer: AUDIO, model: "m/v", contentType: "audio/webm", language, apiKey: API_KEY },
      again.fetchImpl
    );
    assert.equal(
      "language" in requestBody(again.calls),
      false,
      `language ${language} must be omitted, not sent as a literal`
    );
  }
});

test("the no-training routing option is never dropped or swapped for a training-allowed endpoint", async () => {
  const { fetchImpl, calls } = makeFetch({ text: "ok" });
  await transcribeWithOpenRouter(
    {
      audioBuffer: AUDIO,
      model: "vendor/example:exacto",
      contentType: "audio/mp3",
      apiKey: API_KEY,
    },
    fetchImpl
  );
  assert.equal(calls[0].url, "https://openrouter.ai/api/v1/audio/transcriptions");
  assert.equal(requestBody(calls).provider.data_collection, "deny");
});

test("a missing key fails before any request is made", async () => {
  const { fetchImpl, calls } = makeFetch({ text: "ok" });
  for (const apiKey of [undefined, "", "   "]) {
    await assert.rejects(
      transcribeWithOpenRouter(
        { audioBuffer: AUDIO, model: "m/v", contentType: "audio/webm", apiKey },
        fetchImpl
      ),
      (error) => error.code === "API_KEY_MISSING"
    );
  }
  assert.equal(calls.length, 0);
});

test("a missing model id fails before any request is made", async () => {
  const { fetchImpl, calls } = makeFetch({ text: "ok" });
  await assert.rejects(
    transcribeWithOpenRouter(
      { audioBuffer: AUDIO, model: "", contentType: "audio/webm", apiKey: API_KEY },
      fetchImpl
    ),
    (error) => error.code === "MODEL_MISSING"
  );
  assert.equal(calls.length, 0);
});

test("missing or empty audio fails before any request is made", async () => {
  const { fetchImpl, calls } = makeFetch({ text: "ok" });
  for (const audioBuffer of [undefined, Buffer.alloc(0)]) {
    await assert.rejects(
      transcribeWithOpenRouter(
        { audioBuffer, model: "m/v", contentType: "audio/webm", apiKey: API_KEY },
        fetchImpl
      ),
      (error) => error.code === "AUDIO_MISSING"
    );
  }
  assert.equal(calls.length, 0);
});

test("HTTP statuses map to coded provider errors without leaking the key", async () => {
  const statusError = async (status, body = "denied") => {
    const fetchImpl = async () => ({
      ok: false,
      status,
      text: async () => body,
      headers: new Map(),
    });
    return transcribeWithOpenRouter(
      { audioBuffer: AUDIO, model: "m/v", contentType: "audio/webm", apiKey: API_KEY },
      fetchImpl
    ).then(
      () => assert.fail(`status ${status} must reject`),
      (error) => error
    );
  };

  const unauthorized = await statusError(401, "Invalid API key provided");
  assert.equal(unauthorized.code, "PROVIDER_AUTH_FAILED");
  const paymentRequired = await statusError(402, "insufficient credits");
  assert.equal(paymentRequired.code, "PROVIDER_QUOTA_EXHAUSTED");
  const notFound = await statusError(400, "Model not found: m/v");
  assert.equal(notFound.code, "PROVIDER_MODEL_NOT_FOUND");
  const server = await statusError(500);
  assert.equal(server.code, "PROVIDER_UNAVAILABLE");
  for (const error of [unauthorized, paymentRequired, notFound, server]) {
    assert.equal(
      String(error.message).includes(API_KEY),
      false,
      "the key must never appear in a provider error"
    );
    assert.equal(String(error.message).includes("sk-or"), false);
  }
});

test("an unparseable JSON reply fails instead of transcribing empty text", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error("Unexpected token < in JSON");
    },
    text: async () => "<html>",
    headers: new Map(),
  });
  await assert.rejects(
    transcribeWithOpenRouter(
      { audioBuffer: AUDIO, model: "m/v", contentType: "audio/webm", apiKey: API_KEY },
      fetchImpl
    ),
    (error) => error.code === "PROVIDER_BAD_REQUEST" || /transcription/i.test(error.message)
  );
});

test("a 200 reply without text fails rather than resolving an empty transcript", async () => {
  const { fetchImpl } = makeFetch({ data: { nope: true } });
  await assert.rejects(
    transcribeWithOpenRouter(
      { audioBuffer: AUDIO, model: "m/v", contentType: "audio/webm", apiKey: API_KEY },
      fetchImpl
    ),
    /empty/i
  );
});
