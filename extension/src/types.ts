export interface Slide {
  title: string;
  bullets: string[];
}

/** Partially-built slide being streamed right now */
export interface StreamingSlide {
  title: string;
  bullets: string[];
  streamingBullet: string | null;
}

export type Language = "en-US" | "it-IT";
