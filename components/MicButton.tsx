"use client";

import { Mic, MicOff, RotateCcw } from "lucide-react";
import type { Language } from "@/types";

interface MicButtonProps {
  isListening: boolean;
  supported: boolean;
  language: Language;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onLanguageChange: (lang: Language) => void;
}

export function MicButton({
  isListening,
  supported,
  language,
  onStart,
  onStop,
  onReset,
  onLanguageChange,
}: MicButtonProps) {
  const toggleLanguage = () => {
    onLanguageChange(language === "en-US" ? "it-IT" : "en-US");
  };

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
          <MicOff className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-sm text-gray-500 text-center">
          Speech recognition not supported in this browser.
          <br />
          Use Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main mic button */}
      <div className="relative">
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-10 animate-pulse scale-125" />
          </>
        )}
        <button
          onClick={isListening ? onStop : onStart}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 ${
            isListening
              ? "bg-red-500 hover:bg-red-600 focus:ring-red-500 shadow-lg shadow-red-500/30"
              : "bg-gray-700 hover:bg-gray-600 focus:ring-gray-500"
          }`}
          aria-label={isListening ? "Stop recording" : "Start recording"}
        >
          {isListening ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      {/* Status label */}
      <p className="text-sm font-medium tracking-wide">
        {isListening ? (
          <span className="text-red-400">Recording...</span>
        ) : (
          <span className="text-gray-500">Click to start</span>
        )}
      </p>

      {/* Language toggle + Reset */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
          title="Toggle language"
        >
          <span className="text-base">{language === "en-US" ? "🇬🇧" : "🇮🇹"}</span>
          <span>{language === "en-US" ? "EN" : "IT"}</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
          title="Reset session"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}
