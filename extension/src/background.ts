/**
 * Background service worker (MV3)
 *
 * Responsibilities:
 * 1. Receive START/STOP/RESET from popup
 * 2. Get tabCapture stream ID and hand it to the offscreen document
 * 3. Receive transcript chunks from the offscreen document
 * 4. Debounce, call /api/generate, stream + parse slides
 * 5. Push { slides, streamingSlide, isGenerating, error } to connected ports
 *    (the slide-window page that opened /?mode=extension)
 */

import { parseCompleteSlides, parseStreamingSlide } from "./slideParser";
import type { Slide, StreamingSlide } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Config {
  apiBaseUrl: string;
  model: string;
  language: string;
}

interface ExtensionState {
  slides: Slide[];
  streamingSlide: StreamingSlide | null;
  isGenerating: boolean;
  error: string | null;
  isCapturing: boolean;
}

// ── State ─────────────────────────────────────────────────────────────────────

let state: ExtensionState = {
  slides: [],
  streamingSlide: null,
  isGenerating: false,
  error: null,
  isCapturing: false,
};

// Connected ports (slide windows listening for state)
const connectedPorts = new Set<chrome.runtime.Port>();

// Transcript accumulation
let finalTranscript = "";
let interimText = "";

// Debounce
const INTERIM_DEBOUNCE_MS = 1200;
const FINAL_DEBOUNCE_MS = 600;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastProcessedTranscript = "";
let requestId = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setState(patch: Partial<ExtensionState>) {
  state = { ...state, ...patch };
  broadcast({ type: "STATE_UPDATE", payload: state });
  // Also persist capturing state for popup badge
  chrome.storage.local.set({ extensionState: state });
}

function broadcast(msg: unknown) {
  for (const port of connectedPorts) {
    try {
      port.postMessage(msg);
    } catch {
      connectedPorts.delete(port);
    }
  }
}

async function getConfig(): Promise<Config> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { apiBaseUrl: "http://localhost:3000", model: "openai/gpt-4o-mini", language: "en-US" },
      (result) => resolve(result as Config),
    );
  });
}

// ── Offscreen document management ─────────────────────────────────────────────

const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");

async function ensureOffscreenDocument() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [
        chrome.offscreen.Reason.USER_MEDIA,
        chrome.offscreen.Reason.AUDIO_PLAYBACK,
      ],
      justification: "Capture tab audio for speech recognition",
    });
  }
}

async function closeOffscreenDocument() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) {
    await chrome.offscreen.closeDocument();
  }
}

// ── Generate slides from transcript ───────────────────────────────────────────

async function generateSlides(transcript: string) {
  const trimmed = transcript.trim();
  if (!trimmed || trimmed === lastProcessedTranscript) return;
  lastProcessedTranscript = trimmed;

  const currentId = ++requestId;
  setState({ isGenerating: true, streamingSlide: null, error: null });

  const config = await getConfig();
  const url = `${config.apiBaseUrl.replace(/\/$/, "")}/api/generate`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: trimmed, model: config.model }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (currentId !== requestId) {
        reader.cancel();
        return;
      }

      accumulated += decoder.decode(value, { stream: true });

      const complete = parseCompleteSlides(accumulated);
      const inProgress = parseStreamingSlide(accumulated);

      setState({
        slides: complete.length > 0 ? complete : state.slides,
        streamingSlide: inProgress,
      });
    }

    if (currentId !== requestId) return;
    const final = parseCompleteSlides(accumulated);
    setState({
      slides: final.length > 0 ? final : state.slides,
      streamingSlide: null,
      isGenerating: false,
    });
  } catch (err) {
    if (currentId !== requestId) return;
    setState({
      error: err instanceof Error ? err.message : "Generation failed",
      isGenerating: false,
      streamingSlide: null,
    });
  }
}

function scheduleGeneration(isInterim: boolean) {
  if (debounceTimer) clearTimeout(debounceTimer);
  const working = finalTranscript + (interimText ? " " + interimText : "");
  if (!working.trim()) return;

  const delay = isInterim ? INTERIM_DEBOUNCE_MS : FINAL_DEBOUNCE_MS;
  debounceTimer = setTimeout(() => generateSlides(working), delay);
}

// ── Tab capture & start ────────────────────────────────────────────────────────

async function startCapture(tabId: number) {
  await ensureOffscreenDocument();

  // tabCapture.getMediaStreamId must be called from background (MV3)
  const streamId = await new Promise<string>((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(id);
    });
  });

  const config = await getConfig();

  chrome.runtime.sendMessage({
    type: "START_CAPTURE",
    streamId,
    language: config.language,
  });

  setState({ isCapturing: true, error: null });
}

async function stopCapture() {
  if (debounceTimer) clearTimeout(debounceTimer);
  chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
  await closeOffscreenDocument();
  setState({ isCapturing: false, isGenerating: false, streamingSlide: null });
}

function resetState() {
  if (debounceTimer) clearTimeout(debounceTimer);
  finalTranscript = "";
  interimText = "";
  lastProcessedTranscript = "";
  requestId++;
  setState({
    slides: [],
    streamingSlide: null,
    isGenerating: false,
    error: null,
  });
}

// ── Message handlers ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START") {
    (async () => {
      try {
        // Find the active Meet tab
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.id) throw new Error("No active tab found");
        await startCapture(tab.id);
        sendResponse({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Start failed";
        setState({ error: message });
        sendResponse({ ok: false, error: message });
      }
    })();
    return true; // async response
  }

  if (msg.type === "STOP") {
    stopCapture().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "RESET") {
    resetState();
    sendResponse({ ok: true });
  }

  if (msg.type === "GET_STATE") {
    sendResponse(state);
  }

  // Transcript updates from offscreen document
  if (msg.type === "TRANSCRIPT_UPDATE") {
    const { final, interim } = msg as { type: string; final: string; interim: string };
    if (final !== undefined) finalTranscript = final;
    if (interim !== undefined) interimText = interim;
    scheduleGeneration(!!interim);
  }
});

// ── Port connections (slide window) ───────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "slide-window") return;

  connectedPorts.add(port);

  // Immediately push current state to the newly connected window
  try {
    port.postMessage({ type: "STATE_UPDATE", payload: state });
  } catch {
    // port already closed
  }

  port.onDisconnect.addListener(() => {
    connectedPorts.delete(port);
  });
});
