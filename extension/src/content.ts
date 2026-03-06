/**
 * Content script — injected into meet.google.com
 *
 * Currently minimal: just notifies the background that a Meet tab is active.
 * Could be extended later to read meeting metadata (title, participants).
 */

// Let the background know a Meet tab is loaded
chrome.runtime.sendMessage({ type: "MEET_TAB_READY", url: window.location.href });
