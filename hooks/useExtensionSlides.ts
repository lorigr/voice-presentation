"use client";

import { useEffect, useState } from "react";
import type { Slide, StreamingSlide } from "@/types";

export interface ExtensionState {
  slides: Slide[];
  streamingSlide: StreamingSlide | null;
  isGenerating: boolean;
  error: string | null;
}

const INITIAL_STATE: ExtensionState = {
  slides: [],
  streamingSlide: null,
  isGenerating: false,
  error: null,
};

/**
 * Connects to the Chrome extension background service worker via a
 * chrome.runtime.connect port and receives live slide state.
 *
 * Falls back gracefully (returns empty state, isConnected=false) when
 * running outside an extension context (e.g. normal browser tab).
 */
export function useExtensionSlides(): ExtensionState & {
  isConnected: boolean;
} {
  const [state, setState] = useState<ExtensionState>(INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Guard: chrome.runtime is only available inside extension contexts
    // Use globalThis cast to avoid requiring @types/chrome in the Next.js project
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cr = (globalThis as any).chrome;
    if (!cr?.runtime?.connect) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let port: any;

    try {
      port = cr.runtime.connect({ name: "slide-window" });
    } catch {
      // Extension not installed or ID mismatch — fail silently
      return;
    }

    setIsConnected(true);

    port.onMessage.addListener((msg: { type: string; payload: ExtensionState }) => {
      if (msg.type === "STATE_UPDATE") {
        setState(msg.payload);
      }
    });

    port.onDisconnect.addListener(() => {
      setIsConnected(false);
      setState(INITIAL_STATE);
    });

    return () => {
      try {
        port.disconnect();
      } catch {
        // already disconnected
      }
    };
  }, []);

  return { ...state, isConnected };
}
