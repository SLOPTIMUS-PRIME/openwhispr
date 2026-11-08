const { net } = require("electron");
const { PROVIDER_ERROR_CODES, providerError, providerHttpError } = require("./providerHttpErrors");

const ENDPOINT = "https://openrouter.ai/api/v1/audio/transcriptions";
const FORMATS = {
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
};

async function transcribeWithOpenRouter(
  { audioBuffer, model, contentType, language, apiKey },
  fetchImpl
) {
  if (!apiKey?.trim())
    throw providerError(PROVIDER_ERROR_CODES.KEY_MISSING, {
      provider: "OpenRouter",
      surface: "transcription",
    });
  const resolvedModel = (model || "").trim();
  if (!resolvedModel)
    throw Object.assign(new Error("Select an OpenRouter transcription model in Settings."), {
      code: "MODEL_MISSING",
    });
  const audio = audioBuffer ? Buffer.from(audioBuffer) : Buffer.alloc(0);
  if (!audio.length)
    throw Object.assign(new Error("Audio is missing for OpenRouter transcription."), {
      code: "AUDIO_MISSING",
    });
  const mime = (contentType || "audio/webm").split(";")[0].trim().toLowerCase();
  const format = FORMATS[mime];
  if (!format) throw new Error("Unsupported OpenRouter transcription audio format.");
  const body = {
    model: resolvedModel,
    input_audio: { data: audio.toString("base64"), format },
    response_format: "json",
    provider: { data_collection: "deny" },
    ...(language && language !== "auto" ? { language } : {}),
  };
  const doFetch = fetchImpl || ((url, init) => net.fetch(url, init));
  const response = await doFetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw providerHttpError({
      provider: "OpenRouter",
      model: resolvedModel,
      status: response.status,
      body: await response.text().catch(() => ""),
      headers: response.headers,
      surface: "transcription",
    });
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("OpenRouter transcription returned invalid JSON.");
  }
  if (typeof data?.text !== "string" || !data.text.trim())
    throw new Error("OpenRouter returned an empty transcription.");
  return { text: data.text, model: resolvedModel };
}

module.exports = { transcribeWithOpenRouter };
