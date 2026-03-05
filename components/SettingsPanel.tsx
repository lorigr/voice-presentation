"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, X, ChevronDown } from "lucide-react";
import { MODELS, DEFAULT_MODEL } from "@/types";

const STORAGE_KEY = "voice-presentation-model";

interface SettingsPanelProps {
  model: string;
  onModelChange: (model: string) => void;
}

export function SettingsPanel({ model, onModelChange }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (value: string) => {
    if (value === "custom") {
      onModelChange(customValue || "");
    } else {
      onModelChange(value);
    }
  };

  const handleCustomInput = (value: string) => {
    setCustomValue(value);
    onModelChange(value);
  };

  const selectedLabel = isCustom
    ? "Custom"
    : MODELS.find((m) => m.value === model)?.label ?? DEFAULT_MODEL;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-gray-900 border border-gray-700 shadow-xl shadow-black/50 z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Model</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            {MODELS.map((m) => {
              const isSelected =
                m.value === "custom" ? isCustom : model === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => handleSelect(m.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none ${
                    isSelected
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {m.label}
                  {m.value !== "custom" && (
                    <span className="ml-2 text-xs text-gray-600 font-mono">
                      {m.value}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom model input */}
          {(isCustom || model === "custom" || !model) && (
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">
                Custom model ID
              </label>
              <input
                type="text"
                value={customValue}
                onChange={(e) => handleCustomInput(e.target.value)}
                placeholder="e.g. mistralai/mistral-7b-instruct"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600"
              />
            </div>
          )}

          <p className="mt-3 text-xs text-gray-600">
            Model selection is saved in your browser.
          </p>
        </div>
      )}
    </div>
  );
}
