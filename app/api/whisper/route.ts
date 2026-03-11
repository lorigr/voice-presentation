import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * POST /api/whisper
 *
 * Accepts a JSON body: { audio: string (base64 webm/opus), model?: string }
 * Sends the audio to OpenRouter using the `input_audio` multimodal content type
 * (routed to a model that supports audio input, default: google/gemini-2.5-flash).
 * Returns: { text: string }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { audio?: string; model?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { audio, model, language } = body;

  if (!audio || typeof audio !== "string" || !audio.trim()) {
    return new Response(
      JSON.stringify({ error: "audio (base64 string) is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Default to gemini-2.5-flash — cheap, fast, supports audio input on OpenRouter
  const transcriptionModel =
    model && typeof model === "string" && model.trim()
      ? model.trim()
      : "google/gemini-2.5-flash";

  // Build transcription instruction — include language hint when provided
  const langTag =
    language && typeof language === "string" && language.trim()
      ? language.trim()
      : null;
  const languagePrefix = langTag
    ? `The audio language is "${langTag}". `
    : "";
  const transcriptionInstruction = `${languagePrefix}Transcribe this audio accurately. Return ONLY the transcription text, nothing else — no explanations, no labels, no formatting.`;

  try {
    const upstream = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://voice-presentation.local",
          "X-Title": "Voice Presentation",
        },
        body: JSON.stringify({
          model: transcriptionModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: transcriptionInstruction,
                },
                {
                  type: "input_audio",
                  input_audio: {
                    data: audio,
                    format: "webm",
                  },
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 1000,
          stream: false,
        }),
      },
    );

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          error:
            errorData?.error?.message ||
            `OpenRouter error: ${upstream.status}`,
        }),
        {
          status: upstream.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = await upstream.json();
    const text: string =
      data?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
