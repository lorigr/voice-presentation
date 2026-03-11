"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Presentation } from "@/components/Presentation";
import { usePresentationGen } from "@/hooks/usePresentationGen";
import { DEFAULT_MODEL, MODELS } from "@/types";
import { Settings, Trash2, Radio } from "lucide-react";

/**
 * /extension — Full-screen slide view designed for screen sharing.
 *
 * Receives transcript chunks via window.postMessage from the Chrome extension
 * content script, feeds them into usePresentationGen, and displays the slides
 * exactly as the main page does — but without the mic/navbar UI.
 *
 * Message protocol (sent by content.js):
 *   { type: "TRANSCRIPT_CHUNK", text: string }   — append text to transcript
 *   { type: "TRANSCRIPT_RESET" }                 — clear everything
 *   { type: "TRANSCRIPT_STATUS", active: boolean } — capture on/off
 */
export default function ExtensionPage() {
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureLanguage, setCaptureLanguage] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showSettings, setShowSettings] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const transcriptRef = useRef("");

  const effectiveModel =
    model === "custom" ? customModel || DEFAULT_MODEL : model;

  const { slides, streamingSlide, isGenerating, isStreaming, error, clearSlides } =
    usePresentationGen(finalTranscript, "", effectiveModel);

  const handleReset = useCallback(() => {
    transcriptRef.current = "";
    setFinalTranscript("");
    clearSlides();
  }, [clearSlides]);

  // Listen for messages from the Chrome extension content script
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only accept messages from the same origin (localhost)
      if (event.origin !== window.location.origin) return;

      const msg = event.data;
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "TRANSCRIPT_CHUNK": {
          if (typeof msg.text === "string" && msg.text.trim()) {
            transcriptRef.current =
              (transcriptRef.current + " " + msg.text).trim();
            setFinalTranscript(transcriptRef.current);
          }
          break;
        }
        case "TRANSCRIPT_RESET": {
          handleReset();
          break;
        }
        case "TRANSCRIPT_STATUS": {
          setIsCapturing(!!msg.active);
          if (typeof msg.language === "string") setCaptureLanguage(msg.language);
          break;
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleReset]);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Slim top bar — minimal, doesn't distract during screen share */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-800/60 shrink-0">
        <div className="flex items-center gap-2">
          {/* Capture status indicator */}
          {isCapturing ? (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <Radio className="w-3.5 h-3.5" />
              Capturing tab audio
              {captureLanguage && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono text-[10px] uppercase">
                  {captureLanguage}
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-gray-600 font-medium">
              Waiting for capture…
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Reset */}
          <button
            onClick={handleReset}
            title="Clear slides"
            className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-gray-800 transition-all focus:outline-none"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings((v) => !v)}
            title="Model settings"
            className={`p-1.5 rounded-lg transition-all focus:outline-none ${
              showSettings
                ? "text-indigo-400 bg-indigo-500/10"
                : "text-gray-600 hover:text-white hover:bg-gray-800"
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-5 py-3 border-b border-gray-800/60 bg-gray-900/50 flex items-center gap-3 flex-wrap shrink-0">
          <span className="text-xs text-gray-500 font-medium">
            Slide model:
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {model === "custom" && (
            <input
              type="text"
              placeholder="e.g. mistralai/mistral-7b-instruct"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-2.5 py-1.5 w-64 focus:outline-none focus:border-indigo-500 placeholder:text-gray-600"
            />
          )}
          <span className="text-xs text-gray-600 ml-2">
            Audio model: <span className="text-gray-400">google/gemini-2.5-flash</span>
          </span>
        </div>
      )}

      {/* Slide presentation — fills remaining height */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <Presentation
          slides={slides}
          streamingSlide={streamingSlide}
          isGenerating={isGenerating}
          isStreaming={isStreaming}
          error={error}
          isListening={isCapturing}
        />
      </main>
    </div>
  );
}
