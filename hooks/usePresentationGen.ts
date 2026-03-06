"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Slide, StreamingSlide } from "@/types";
import { parseCompleteSlides, parseStreamingSlide } from "@/lib/slideParser";

// How long to wait after the last speech change before generating
const INTERIM_DEBOUNCE_MS = 1200; // fires while still talking
const FINAL_DEBOUNCE_MS = 600; // fires quickly once a sentence is committed

interface UsePresentationGenReturn {
  slides: Slide[];
  streamingSlide: StreamingSlide | null;
  isGenerating: boolean;
  isStreaming: boolean;
  error: string | null;
  clearSlides: () => void;
}

export function usePresentationGen(
  finalTranscript: string,
  interimText: string,
  model: string,
): UsePresentationGenReturn {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [streamingSlide, setStreamingSlide] = useState<StreamingSlide | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedRef = useRef("");
  // Track in-flight request so we can ignore stale results
  const requestIdRef = useRef(0);

  const generate = useCallback(
    async (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed || trimmed === lastProcessedRef.current) return;
      lastProcessedRef.current = trimmed;

      const currentId = ++requestIdRef.current;
      setIsGenerating(true);
      setIsStreaming(false);
      setStreamingSlide(null);
      setError(null);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: trimmed, model }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        // ── Streaming path ──────────────────────────────────────────────
        if (!res.body) throw new Error("No response body");

        setIsStreaming(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (currentId !== requestIdRef.current) {
            reader.cancel();
            return;
          }

          accumulated += decoder.decode(value, { stream: true });

          // Complete slides that have fully arrived
          const complete = parseCompleteSlides(accumulated);
          if (complete.length > 0) setSlides(complete);

          // The slide currently being written character by character
          const inProgress = parseStreamingSlide(accumulated);
          setStreamingSlide(inProgress);
        }

        // Final pass — clear streaming slide, keep only complete ones
        if (currentId !== requestIdRef.current) return;
        const final = parseCompleteSlides(accumulated);
        if (final.length > 0) setSlides(final);
        setStreamingSlide(null);
      } catch (err) {
        if (currentId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        if (currentId === requestIdRef.current) {
          setIsGenerating(false);
          setIsStreaming(false);
          setStreamingSlide(null);
        }
      }
    },
    [model],
  );

  // Combine final + interim so we always send the most complete version
  const workingTranscript =
    finalTranscript + (interimText ? " " + interimText : "");

  useEffect(() => {
    if (!workingTranscript.trim()) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Use a shorter debounce when there is new committed (final) speech,
    // and a slightly longer one while only interim text is changing.
    const debounce = interimText ? INTERIM_DEBOUNCE_MS : FINAL_DEBOUNCE_MS;

    timerRef.current = setTimeout(() => {
      generate(workingTranscript);
    }, debounce);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingTranscript, generate]);

  const clearSlides = useCallback(() => {
    setSlides([]);
    setStreamingSlide(null);
    setError(null);
    lastProcessedRef.current = "";
    requestIdRef.current = 0;
  }, []);

  return {
    slides,
    streamingSlide,
    isGenerating,
    isStreaming,
    error,
    clearSlides,
  };
}
