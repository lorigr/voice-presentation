"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Slide, StreamingSlide } from "@/types";

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

/**
 * Extract all COMPLETE slide objects from a partial JSON buffer.
 */
function parseCompleteSlides(raw: string): Slide[] {
  const arrayStart = raw.indexOf("[");
  if (arrayStart === -1) return [];

  const slides: Slide[] = [];
  let depth = 0;
  let objectStart = -1;

  for (let i = arrayStart; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        try {
          const obj = JSON.parse(raw.slice(objectStart, i + 1));
          if (obj.title && Array.isArray(obj.bullets))
            slides.push(obj as Slide);
        } catch {
          /* malformed — skip */
        }
        objectStart = -1;
      }
    }
  }
  return slides;
}

/**
 * Parse the LAST (incomplete) slide object being streamed right now.
 * Returns a StreamingSlide with partial title, completed bullets, and the
 * bullet currently being typed character by character.
 */
function parseStreamingSlide(raw: string): StreamingSlide | null {
  // Find the start of the last incomplete object (no matching closing `}`)
  const arrayStart = raw.indexOf("[");
  if (arrayStart === -1) return null;

  // Walk forward tracking depth; the last open `{` that never closed is our target
  let depth = 0;
  let lastOpenAt = -1;
  for (let i = arrayStart; i < raw.length; i++) {
    if (raw[i] === "{") {
      if (depth === 0) lastOpenAt = i;
      depth++;
    } else if (raw[i] === "}") {
      depth--;
      if (depth === 0) lastOpenAt = -1;
    }
  }
  if (lastOpenAt === -1) return null; // no incomplete object

  const fragment = raw.slice(lastOpenAt); // e.g. {"title":"Foo","bullets":["bar","baz

  // --- title ---
  const titleMatch = fragment.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const title = titleMatch ? titleMatch[1] : "";

  // --- bullets ---
  const bulletsStart = fragment.indexOf('"bullets"');
  if (bulletsStart === -1)
    return title ? { title, bullets: [], streamingBullet: null } : null;

  const arrayOpen = fragment.indexOf("[", bulletsStart);
  if (arrayOpen === -1) return { title, bullets: [], streamingBullet: null };

  const bulletsFragment = fragment.slice(arrayOpen + 1); // everything after [

  // Walk through completed quoted strings
  const completedBullets: string[] = [];
  let streamingBullet: string | null = null;
  let pos = 0;

  while (pos < bulletsFragment.length) {
    // skip whitespace / commas
    while (pos < bulletsFragment.length && /[\s,]/.test(bulletsFragment[pos]))
      pos++;
    if (pos >= bulletsFragment.length) break;
    if (bulletsFragment[pos] === "]") break; // closed array

    if (bulletsFragment[pos] === '"') {
      // Read a quoted string (handle escape sequences)
      let str = "";
      pos++; // skip opening quote
      let closed = false;
      while (pos < bulletsFragment.length) {
        const c = bulletsFragment[pos];
        if (c === "\\") {
          str += bulletsFragment[++pos] ?? "";
          pos++;
          continue;
        }
        if (c === '"') {
          closed = true;
          pos++;
          break;
        }
        str += c;
        pos++;
      }
      if (closed) {
        completedBullets.push(str);
      } else {
        // String not yet closed — this is the one being typed right now
        streamingBullet = str;
        break;
      }
    } else {
      pos++; // unexpected char, skip
    }
  }

  return { title, bullets: completedBullets, streamingBullet };
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
