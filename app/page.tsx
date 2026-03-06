"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Presentation } from "@/components/Presentation";
import { Navbar } from "@/components/Navbar";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { usePresentationGen } from "@/hooks/usePresentationGen";
import { useExtensionSlides } from "@/hooks/useExtensionSlides";
import { DEFAULT_MODEL } from "@/types";
import type { Language } from "@/types";

// Inner component needs useSearchParams, which requires Suspense boundary
function HomeInner() {
  const searchParams = useSearchParams();
  const isExtensionMode = searchParams.get("mode") === "extension";

  const [language, setLanguage] = useState<Language>("en-US");
  const [model, setModel] = useState(DEFAULT_MODEL);

  // Normal mode: mic + local generation
  const {
    isListening,
    finalTranscript,
    interimText,
    start,
    stop,
    reset,
    supported,
  } = useSpeechRecognition(isExtensionMode ? "en-US" : language);

  const {
    slides: genSlides,
    streamingSlide: genStreamingSlide,
    isGenerating: genIsGenerating,
    isStreaming: genIsStreaming,
    error: genError,
    clearSlides,
  } = usePresentationGen(
    isExtensionMode ? "" : finalTranscript,
    isExtensionMode ? "" : interimText,
    model,
  );

  // Extension mode: receive state from background via port
  const {
    slides: extSlides,
    streamingSlide: extStreamingSlide,
    isGenerating: extIsGenerating,
    error: extError,
  } = useExtensionSlides();

  const slides = isExtensionMode ? extSlides : genSlides;
  const streamingSlide = isExtensionMode ? extStreamingSlide : genStreamingSlide;
  const isGenerating = isExtensionMode ? extIsGenerating : genIsGenerating;
  const isStreaming = isExtensionMode ? false : genIsStreaming;
  const error = isExtensionMode ? extError : genError;

  const handleReset = () => {
    reset();
    clearSlides();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Presentation — fills all space above the floating navbar */}
      <main
        className={
          isExtensionMode
            ? "flex-1 min-h-0 overflow-hidden"
            : "flex-1 min-h-0 pb-20 overflow-hidden"
        }
      >
        <Presentation
          slides={slides}
          streamingSlide={streamingSlide}
          isGenerating={isGenerating}
          isStreaming={isStreaming}
          error={error}
          isListening={isListening}
        />
      </main>

      {/* Floating bottom navbar — hidden in extension mode */}
      {!isExtensionMode && (
        <Navbar
          isListening={isListening}
          supported={supported}
          language={language}
          model={model}
          onStart={start}
          onStop={stop}
          onReset={handleReset}
          onLanguageChange={setLanguage}
          onModelChange={setModel}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
