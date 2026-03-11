/**
 * offscreen.js — Offscreen Document (MV3, Chrome 116+)
 *
 * Has full DOM access. Uses getUserMedia with the tab stream ID
 * provided by the service worker to capture tab audio, then:
 *  - Pipes it through an AudioContext → output so the user still hears the tab
 *  - Records it with MediaRecorder, sending chunks every ~4s back to background.js
 *
 * Messages received (from background.js via chrome.runtime.sendMessage):
 *   { action: "startRecording", streamId: string }
 *   { action: "stopRecording" }
 *
 * Messages sent (to background.js):
 *   { action: "audioChunk", base64: string, mimeType: string }
 *   { action: "recordingError", error: string }
 */

const CHUNK_INTERVAL_MS = 4000;

let mediaRecorder = null;
let captureStream = null;
let audioContext = null;
let chunkTimer = null;
let audioChunks = [];
let currentMimeType = "audio/webm;codecs=opus";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSupportedMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function blobToBase64(blob) {
  const ab = await blob.arrayBuffer();
  return arrayBufferToBase64(ab);
}

// ─── Recording ────────────────────────────────────────────────────────────────

async function startRecording(streamId) {
  if (mediaRecorder) await stopRecording();

  try {
    // Retrieve the tab's audio as a MediaStream using the stream ID.
    // The mandatory constraints are required — standard getUserMedia constraints
    // won't work with chromeMediaSource.
    captureStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    // ── Keep the tab audio playing for the user ──────────────────────────────
    // Capturing a tab mutes it by default. Reconnect it to the speaker output.
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(captureStream);
    source.connect(audioContext.destination);

    // ── Record for transcription ─────────────────────────────────────────────
    currentMimeType = getSupportedMimeType();
    mediaRecorder = new MediaRecorder(captureStream, { mimeType: currentMimeType });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onerror = (e) => {
      chrome.runtime.sendMessage({
        action: "recordingError",
        error: e.error?.message || "MediaRecorder error",
      });
    };

    mediaRecorder.start();
    console.log("[VP offscreen] Recording started, mimeType:", currentMimeType);

    // Send a chunk every CHUNK_INTERVAL_MS
    chunkTimer = setInterval(async () => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") return;

      // Snapshot current chunks and clear for next interval
      audioChunks = [];
      mediaRecorder.requestData();

      // Brief pause for ondataavailable to fire (it fires synchronously in Chrome)
      await new Promise((r) => setTimeout(r, 150));

      if (audioChunks.length === 0) return;

      const blob = new Blob(audioChunks, { type: currentMimeType });
      audioChunks = [];

      if (blob.size < 1000) return; // skip silence / near-empty chunks

      const base64 = await blobToBase64(blob);
      chrome.runtime.sendMessage({ action: "audioChunk", base64, mimeType: currentMimeType });
    }, CHUNK_INTERVAL_MS);
  } catch (err) {
    console.error("[VP offscreen] startRecording error:", err);
    chrome.runtime.sendMessage({ action: "recordingError", error: err.message });
  }
}

async function stopRecording() {
  if (chunkTimer) {
    clearInterval(chunkTimer);
    chunkTimer = null;
  }

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  mediaRecorder = null;

  if (audioContext) {
    await audioContext.close().catch(() => {});
    audioContext = null;
  }

  if (captureStream) {
    captureStream.getTracks().forEach((t) => t.stop());
    captureStream = null;
  }

  audioChunks = [];
  console.log("[VP offscreen] Recording stopped");
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "startRecording") {
    startRecording(msg.streamId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // async
  }

  if (msg.action === "stopRecording") {
    stopRecording()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
