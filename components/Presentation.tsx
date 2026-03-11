"use client";

import { useState, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  Loader2,
  Mic,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Slide, StreamingSlide } from "@/types";

interface PresentationProps {
  slides: Slide[];
  streamingSlide: StreamingSlide | null;
  isGenerating: boolean;
  isStreaming: boolean;
  error: string | null;
  isListening: boolean;
}

const ACCENT_COLORS = [
  "from-violet-500 to-indigo-500",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-amber-400",
  "from-pink-500 to-rose-400",
  "from-fuchsia-500 to-purple-400",
];

export function Presentation({
  slides,
  streamingSlide,
  isGenerating,
  isStreaming,
  error,
  isListening,
}: PresentationProps) {
  const [copied, setCopied] = useState(false);
  const [current, setCurrent] = useState(0);
  const prevSlidesLen = useRef(0);

  // Auto-advance to the newest slide when slides are added/replaced
  useEffect(() => {
    if (slides.length > 0 && slides.length !== prevSlidesLen.current) {
      setCurrent(slides.length - 1);
      prevSlidesLen.current = slides.length;
    }
  }, [slides]);

  const slide = slides[current] ?? null;
  const accent = ACCENT_COLORS[current % ACCENT_COLORS.length];

  const toMarkdown = () =>
    slides
      .map((s) => `## ${s.title}\n${s.bullets.map((b) => `- ${b}`).join("\n")}`)
      .join("\n\n");

  const handleCopy = async () => {
    if (!slides.length) return;
    try {
      await navigator.clipboard.writeText(toMarkdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied
    }
  };

  const isEmpty = slides.length === 0 && !isGenerating && !error;

  return (
    <div className="flex flex-col h-full">
      {/* Top status bar */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
        <div className="flex items-center gap-2 h-5">
          {isGenerating && !isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium tracking-wide">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating...
            </span>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Streaming...
            </span>
          )}
          {isListening && !isGenerating && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Listening
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {slides.length > 0 && (
            <span className="text-xs text-gray-600 tabular-nums">
              {current + 1} / {slides.length}
            </span>
          )}
          {slides.length > 0 && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white transition-all focus:outline-none border border-gray-700/50"
              title="Copy all as Markdown"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy all</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main stage */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 pb-4">
        {/* Error */}
        {error && (
          <div className="w-full max-w-2xl px-4 py-3 rounded-xl bg-red-950/60 border border-red-800/60 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center shadow-xl">
                <Mic className="w-10 h-10 text-gray-600" />
              </div>
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-2xl" />
            </div>
            <div className="space-y-1.5">
              <p className="text-gray-300 text-lg font-medium">
                Start speaking
              </p>
              <p className="text-gray-600 text-sm">
                Slides will appear and update as you talk.
              </p>
            </div>
          </div>
        )}

        {/* Skeleton - first generation (before any streaming data arrives) */}
        {isGenerating && slides.length === 0 && !streamingSlide && (
          <div className="w-full max-w-2xl rounded-2xl bg-gray-900/80 border border-gray-800/80 overflow-hidden animate-pulse">
            <div
              className={`h-1 w-full bg-gradient-to-r ${ACCENT_COLORS[0]}`}
            />
            <div className="p-10">
              <div className="h-5 bg-gray-700 rounded-full w-2/5 mb-8" />
              <div className="space-y-4">
                <div className="h-3.5 bg-gray-800 rounded-full w-5/6" />
                <div className="h-3.5 bg-gray-800 rounded-full w-3/5" />
                <div className="h-3.5 bg-gray-800 rounded-full w-4/5" />
                <div className="h-3.5 bg-gray-800 rounded-full w-2/3" />
              </div>
            </div>
          </div>
        )}

        {/* Live streaming card — shown while tokens are arriving */}
        {isStreaming && streamingSlide && (
          <div className="w-full max-w-2xl rounded-2xl bg-gray-900/90 border border-indigo-500/30 overflow-hidden shadow-2xl">
            <div
              className={`h-1 w-full bg-gradient-to-r ${ACCENT_COLORS[slides.length % ACCENT_COLORS.length]}`}
            />
            <div className="px-10 py-10">
              {/* Title — builds character by character */}
              <h2 className="text-3xl font-bold text-white leading-snug min-h-[2.5rem]">
                {streamingSlide.title}
                {!streamingSlide.title && (
                  <span className="inline-block w-0.5 h-7 bg-indigo-400 animate-pulse align-middle" />
                )}
              </h2>

              {(streamingSlide.bullets.length > 0 ||
                streamingSlide.streamingBullet !== null) && (
                <>
                  <div
                    className={`mt-5 mb-6 h-px w-12 bg-gradient-to-r ${ACCENT_COLORS[slides.length % ACCENT_COLORS.length]} opacity-60`}
                  />
                  <ul className="space-y-3.5">
                    {/* Completed bullets */}
                    {streamingSlide.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3.5 text-base text-gray-300 leading-relaxed"
                      >
                        <span
                          className={`mt-2.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${ACCENT_COLORS[slides.length % ACCENT_COLORS.length]} flex-shrink-0`}
                        />
                        {b}
                      </li>
                    ))}
                    {/* Bullet currently being typed */}
                    {streamingSlide.streamingBullet !== null && (
                      <li className="flex items-start gap-3.5 text-base text-gray-300 leading-relaxed">
                        <span
                          className={`mt-2.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${ACCENT_COLORS[slides.length % ACCENT_COLORS.length]} flex-shrink-0`}
                        />
                        {streamingSlide.streamingBullet}
                        <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 mt-0.5 animate-pulse align-middle flex-shrink-0" />
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {/* Full-screen slide card — shown when not streaming or when streaming hasn't produced content yet */}
        {slide && (!isStreaming || !streamingSlide) && (
          <div className="w-full max-w-2xl flex flex-col gap-6">
            <div className="relative rounded-2xl bg-gray-900/90 border border-gray-800/80 overflow-hidden shadow-2xl">
              {/* Top gradient bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />

              <div className="px-10 py-10">
                {/* Slide number */}
                <span
                  className={`text-[11px] font-bold tracking-widest uppercase bg-gradient-to-r ${accent} bg-clip-text text-transparent`}
                >
                  {String(current + 1).padStart(2, "0")} /{" "}
                  {String(slides.length).padStart(2, "0")}
                </span>

                {/* Title */}
                <h2 className="mt-3 text-3xl font-bold text-white leading-snug">
                  {slide.title}
                </h2>

                {/* Divider */}
                <div
                  className={`mt-5 mb-6 h-px w-12 bg-gradient-to-r ${accent} opacity-60`}
                />

                {/* Bullets */}
                <ul className="space-y-3.5">
                  {slide.bullets.map((bullet, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-3.5 text-base text-gray-300 leading-relaxed"
                    >
                      <span
                        className={`mt-2.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${accent} flex-shrink-0`}
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Navigation */}
            {slides.length > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-white hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all focus:outline-none"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>

                {/* Dot indicators */}
                <div className="flex items-center gap-1.5">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      className={`rounded-full transition-all focus:outline-none ${
                        i === current
                          ? `w-5 h-1.5 bg-gradient-to-r ${accent}`
                          : "w-1.5 h-1.5 bg-gray-700 hover:bg-gray-500"
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() =>
                    setCurrent((c) => Math.min(slides.length - 1, c + 1))
                  }
                  disabled={current === slides.length - 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-white hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all focus:outline-none"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
