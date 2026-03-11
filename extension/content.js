/**
 * content.js — Injected into localhost:3000/extension
 *
 * Bridges the Chrome extension message channel (chrome.runtime.onMessage)
 * to the Next.js page's window.postMessage listener.
 *
 * Messages received from background.js:
 *   { type: "TRANSCRIPT_CHUNK", text: string }
 *   { type: "TRANSCRIPT_RESET" }
 *   { type: "TRANSCRIPT_STATUS", active: boolean }
 *
 * All messages are forwarded verbatim via window.postMessage with
 * targetOrigin = window.location.origin so the page's useEffect picks them up.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message?.type === "TRANSCRIPT_CHUNK" ||
    message?.type === "TRANSCRIPT_RESET" ||
    message?.type === "TRANSCRIPT_STATUS"
  ) {
    window.postMessage(message, window.location.origin);
    sendResponse({ ok: true });
  }
  // Return false — response is synchronous
  return false;
});
