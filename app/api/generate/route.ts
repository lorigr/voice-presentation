import { NextRequest } from "next/server";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are a presentation assistant. The user is speaking live — their words will come in as a continuous transcript.

Your job is to organize the spoken content into clean presentation slides. Each slide should have:
- A short, descriptive title (max 6 words)
- 3 to 5 concise bullet points capturing key ideas

Rules:
- Respond ONLY with valid JSON, no markdown, no explanation
- Format: {"slides":[{"title":"...","bullets":["...","..."]}]}
- Group related ideas into the same slide
- Create a new slide when the topic shifts
- Keep bullets short and clear (under 12 words each)
- The input may be in English or Italian — respond in the SAME language as the input
- Do not add information not present in the transcript`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "OPENROUTER_API_KEY is not set in environment variables",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { transcript?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { transcript, model } = body;

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return new Response(JSON.stringify({ error: "transcript is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const selectedModel =
    model && typeof model === "string" && model.trim()
      ? model.trim()
      : "google/gemini-flash-1.5";

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
          model: selectedModel,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: transcript.trim() },
          ],
          temperature: 0.3,
          max_tokens: 1500,
          stream: true,
        }),
      },
    );

    if (!upstream.ok) {
      const errorData = await upstream.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          error:
            errorData?.error?.message || `OpenRouter error: ${upstream.status}`,
        }),
        {
          status: upstream.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Transform the OpenRouter SSE stream into a plain text stream
    // so the client receives the raw content delta chunks.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformed = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        // Each SSE message is "data: {...}\n\n" or "data: [DONE]\n\n"
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            // ignore malformed lines
          }
        }
      },
    });

    upstream.body!.pipeTo(transformed.writable);

    return new Response(transformed.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
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
