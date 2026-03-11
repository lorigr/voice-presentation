/**
 * background.js — Service Worker (Manifest V3)
 *
 * Flow:
 *   1. chrome.tabCapture.getMediaStreamId()  → stream ID (Promise, Chrome 116+)
 *   2. Ensure offscreen document exists       → chrome.runtime.getContexts()
 *   3. Send stream ID to offscreen.js         → it calls getUserMedia + MediaRecorder
 *   4. Receive base64 audio chunks back       → POST /api/whisper
 *   5. Forward transcript to slides tab       → content.js → postMessage
 *
 * Message API (from popup.js):
 *   { action: "startCapture", slidesTabId: number, language?: string, endpoint?: string }
 *   { action: "stopCapture" }
 *   { action: "getStatus" }  → { capturing: bool, slidesTabId: number|null }
 *   { action: "resetSlides" }
 */

const DEFAULT_ENDPOINT = "http://localhost:3000";

let isCapturing    = false;
let slidesTabId    = null;
let captureLanguage = "";           // BCP-47 tag or "" for auto-detect
let captureEndpoint = DEFAULT_ENDPOINT;

function getWhisperEndpoint() {
  return `${captureEndpoint}/api/whisper`;
}

// ─── Offscreen document helpers ──────────────────────────────────────────────

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");

  let hasDoc = false;
  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl],
    });
    hasDoc = contexts.length > 0;
  } else {
    const matched = await clients.matchAll();
    hasDoc = matched.some((c) => c.url === offscreenUrl);
  }

  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Record tab audio chunks for transcription",
    });
  }
}

async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument();
  } catch {
    // already closed — fine
  }
}

// ─── Tab communication ────────────────────────────────────────────────────────

async function sendToSlidesTab(message) {
  if (!slidesTabId) return;
  try {
    await chrome.tabs.sendMessage(slidesTabId, message);
  } catch (err) {
    console.warn("[VP] Could not reach slides tab:", err.message);
  }
}

// ─── Whisper transcription ────────────────────────────────────────────────────

async function transcribeAndForward(base64Audio) {
  try {
    const body = { audio: base64Audio };
    if (captureLanguage) body.language = captureLanguage;

    const res = await fetch(getWhisperEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn("[VP] Whisper API error:", res.status, await res.text());
      return;
    }

    const data = await res.json();
    const text = data?.text?.trim();
    if (!text) return;

    console.log("[VP] Transcript:", text);
    await sendToSlidesTab({ type: "TRANSCRIPT_CHUNK", text });
  } catch (err) {
    console.error("[VP] Transcription failed:", err);
  }
}

// ─── Capture lifecycle ────────────────────────────────────────────────────────

async function startCapture(targetSlidesTabId, language, endpoint) {
  if (isCapturing) await stopCapture();

  slidesTabId      = targetSlidesTabId;
  captureLanguage  = language  || "";
  captureEndpoint  = (endpoint || DEFAULT_ENDPOINT).replace(/\/$/, "");

  // getMediaStreamId returns a Promise on Chrome 116+.
  const streamId = await chrome.tabCapture.getMediaStreamId();

  await ensureOffscreenDocument();

  const resp = await chrome.runtime.sendMessage({
    action: "startRecording",
    streamId,
  });

  if (!resp?.ok) {
    await closeOffscreenDocument();
    throw new Error(resp?.error || "Offscreen recording failed to start");
  }

  isCapturing = true;
  await sendToSlidesTab({ type: "TRANSCRIPT_STATUS", active: true, language: captureLanguage });
  console.log("[VP] Capture started — endpoint:", captureEndpoint, "language:", captureLanguage || "auto");
}

async function stopCapture() {
  isCapturing = false;

  await chrome.runtime.sendMessage({ action: "stopRecording" }).catch(() => {});
  await closeOffscreenDocument();
  await sendToSlidesTab({ type: "TRANSCRIPT_STATUS", active: false });

  console.log("[VP] Capture stopped");
}

// ─── Messages ─────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Audio chunk from offscreen.js
  if (msg.action === "audioChunk") {
    transcribeAndForward(msg.base64); // fire-and-forget
    sendResponse({ ok: true });
    return false;
  }

  // Recording error from offscreen.js
  if (msg.action === "recordingError") {
    console.error("[VP] Recording error:", msg.error);
    isCapturing = false;
    sendToSlidesTab({ type: "TRANSCRIPT_STATUS", active: false });
    closeOffscreenDocument().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  // Status query from popup
  if (msg.action === "getStatus") {
    sendResponse({ capturing: isCapturing, slidesTabId });
    return false;
  }

  // Start capture — triggered by popup button click
  if (msg.action === "startCapture") {
    startCapture(msg.slidesTabId, msg.language, msg.endpoint)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[VP] startCapture error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep message channel open for async response
  }

  // Stop capture
  if (msg.action === "stopCapture") {
    stopCapture()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // Reset slides
  if (msg.action === "resetSlides") {
    sendToSlidesTab({ type: "TRANSCRIPT_RESET" });
    sendResponse({ ok: true });
    return false;
  }
});
