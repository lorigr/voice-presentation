export interface Slide {
  title: string;
  bullets: string[];
}

/** Partially-built slide being streamed right now */
export interface StreamingSlide {
  title: string; // may be incomplete while being typed
  bullets: string[]; // completed bullets so far
  streamingBullet: string | null; // bullet currently being typed (incomplete)
}

export type Language = "en-US" | "it-IT";

export const MODELS = [
  { label: "Gemini Flash 1.5", value: "google/gemini-flash-1.5" },
  { label: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
  { label: "Claude 3 Haiku", value: "anthropic/claude-3-haiku" },
  { label: "Custom", value: "custom" },
] as const;

export const DEFAULT_MODEL = "google/gemini-flash-1.5";
