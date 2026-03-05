"use client";

import { useState, useEffect } from "react";
import { Mic, MicOff, RotateCcw, Settings } from "lucide-react";
import { MODELS } from "@/types";
import type { Language } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STORAGE_KEY = "voice-presentation-model";

interface NavbarProps {
  isListening: boolean;
  supported: boolean;
  language: Language;
  model: string;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onLanguageChange: (lang: Language) => void;
  onModelChange: (model: string) => void;
}

export function Navbar({
  isListening,
  supported,
  language,
  model,
  onStart,
  onStop,
  onReset,
  onLanguageChange,
  onModelChange,
}: NavbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const isCustom = !MODELS.some((m) => m.value === model);

  // Load persisted model on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      onModelChange(saved);
      if (!MODELS.some((m) => m.value === saved)) {
        setCustomValue(saved);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, model);
  }, [model]);

  const handleSelect = (value: string) => {
    if (value === "custom") {
      onModelChange(customValue || "");
    } else {
      onModelChange(value);
      setSettingsOpen(false);
    }
  };

  const handleCustomInput = (value: string) => {
    setCustomValue(value);
    onModelChange(value);
  };

  return (
    <TooltipProvider delayDuration={300}>
      {/* Full-width sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-gray-900/95 backdrop-blur-md shadow-[0_-4px_32px_rgba(0,0,0,0.5)]">
        <nav className="flex items-center justify-center gap-1 px-4 py-3 w-full max-w-screen-xl mx-auto">
          {/* Language toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onLanguageChange(language === "en-US" ? "it-IT" : "en-US")
                }
                className="flex flex-col items-center gap-0.5 h-auto py-1.5 px-3 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span className="text-base leading-none">
                  {language === "en-US" ? "🇬🇧" : "🇮🇹"}
                </span>
                <span className="text-[9px] font-semibold tracking-widest uppercase opacity-60">
                  {language === "en-US" ? "EN" : "IT"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="rounded-full text-xs">
              Toggle language
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Mic button — centrepiece */}
          <div className="relative mx-1">
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                <span className="absolute -inset-2 rounded-full bg-red-500/10 animate-pulse" />
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={isListening ? onStop : onStart}
                  disabled={!supported}
                  size="icon"
                  className={`relative w-11 h-11 rounded-full transition-all duration-200 ${
                    !supported
                      ? "bg-white/5 cursor-not-allowed opacity-40"
                      : isListening
                        ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/50"
                        : "bg-white/15 hover:bg-white/25"
                  }`}
                  aria-label={
                    isListening ? "Stop recording" : "Start recording"
                  }
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5 text-white" />
                  ) : (
                    <Mic className="w-5 h-5 text-white" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="rounded-full text-xs">
                {!supported
                  ? "Not supported"
                  : isListening
                    ? "Stop recording"
                    : "Start recording"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Reset */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onReset}
                className="rounded-full w-9 h-9 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Reset session"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="rounded-full text-xs">
              Reset session
            </TooltipContent>
          </Tooltip>

          {/* Settings popover */}
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full w-9 h-9 transition-colors hover:bg-white/10 ${
                      settingsOpen
                        ? "text-white bg-white/15"
                        : "text-gray-400 hover:text-white"
                    }`}
                    aria-label="Model settings"
                  >
                    <Settings
                      className={`w-4 h-4 transition-transform duration-300 ${settingsOpen ? "rotate-90" : ""}`}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="rounded-full text-xs">
                Model settings
              </TooltipContent>
            </Tooltip>

            <PopoverContent
              side="top"
              align="center"
              sideOffset={16}
              className="w-64 p-3 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl shadow-black/80 text-white"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-2 px-1">
                Model
              </p>

              <div className="space-y-0.5">
                {MODELS.map((m) => {
                  const isSelected =
                    m.value === "custom" ? isCustom : model === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => handleSelect(m.value)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors focus:outline-none flex items-center justify-between group ${
                        isSelected
                          ? "bg-white/10 text-white"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{m.label}</span>
                      {m.value !== "custom" && (
                        <span className="text-[10px] text-gray-600 font-mono group-hover:text-gray-500 transition-colors">
                          {m.value.split("/")[1]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {(isCustom || model === "custom" || !model) && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <label className="block text-[10px] text-gray-500 mb-1.5 px-1 uppercase tracking-widest font-semibold">
                    Custom model ID
                  </label>
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => handleCustomInput(e.target.value)}
                    placeholder="e.g. mistralai/mistral-7b-instruct"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>
        </nav>
      </div>
    </TooltipProvider>
  );
}
