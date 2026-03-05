"use client";

import { useState } from "react";
import { Presentation } from "@/components/Presentation";
import { Navbar } from "@/components/Navbar";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { usePresentationGen } from "@/hooks/usePresentationGen";
import { DEFAULT_MODEL } from "@/types";
import type { Language } from "@/types";

export default function Home() {
  const [language, setLanguage] = useState<Language>("en-US");
  const [model, setModel] = useState(DEFAULT_MODEL);

  const {
    isListening,
    finalTranscript,
    interimText,
    start,
    stop,
    reset,
    supported,
  } = useSpeechRecognition(language);

  const {
    slides,
    streamingSlide,
    isGenerating,
    isStreaming,
    error,
    clearSlides,
  } = usePresentationGen(finalTranscript, interimText, model);

  const handleReset = () => {
    reset();
    clearSlides();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Presentation — fills all space above the floating navbar */}
      <main className="flex-1 min-h-0 pb-20 overflow-hidden">
        <Presentation
          slides={slides}
          streamingSlide={streamingSlide}
          isGenerating={isGenerating}
          isStreaming={isStreaming}
          error={error}
          isListening={isListening}
        />
      </main>

      {/* Floating bottom navbar */}
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
    </div>
  );
}
