"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Language } from "@/types";

// Minimal typings for Web Speech API (not fully typed in all TS versions)
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  interimText: string;
  finalTranscript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  supported: boolean;
}

export function useSpeechRecognition(
  language: Language,
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const finalTranscriptRef = useRef("");

  // Detect support client-side only (window is undefined during SSR)
  useEffect(() => {
    setSupported(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    );
  }, []);

  const buildRecognition = useCallback((): ISpeechRecognition | null => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window))
      return null;
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = "";
      let newFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      if (newFinal) {
        finalTranscriptRef.current += newFinal;
        setFinalTranscript(finalTranscriptRef.current);
      }
      setInterimText(interim);
    };

    recognition.onend = () => {
      setInterimText("");
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch {
          // already started
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("SpeechRecognition error:", event.error);
    };

    return recognition;
  }, [language]);

  // Rebuild recognition when language changes
  useEffect(() => {
    if (isListening) {
      shouldRestartRef.current = false;
      recognitionRef.current?.stop();
      const newRec = buildRecognition();
      recognitionRef.current = newRec;
      if (newRec) {
        shouldRestartRef.current = true;
        newRec.start();
        setIsListening(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const start = useCallback(() => {
    if (!supported) return;
    const recognition = buildRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    recognition.start();
    setIsListening(true);
  }, [buildRecognition, supported]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  const reset = useCallback(() => {
    stop();
    finalTranscriptRef.current = "";
    setFinalTranscript("");
    setInterimText("");
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    isListening,
    interimText,
    finalTranscript,
    start,
    stop,
    reset,
    supported,
  };
}
