/**
 * popup.js — Extension popup controller
 *
 * Manages the popup UI state and coordinates with background.js.
 * Settings (language, endpoint) are persisted via chrome.storage.local.
 */

const DEFAULT_ENDPOINT = "http://localhost:3000";

// ─── DOM refs ────────────────────────────────────────────────────────────────

const statusDot      = document.getElementById("statusDot");
const statusText     = document.getElementById("statusText");
const captureBtn     = document.getElementById("captureBtn");
const captureBtnIcon = document.getElementById("captureBtnIcon");
const captureBtnLabel= document.getElementById("captureBtnLabel");
const openSlidesBtn  = document.getElementById("openSlidesBtn");
const slidesTabInfo  = document.getElementById("slidesTabInfo");
const resetBtn       = document.getElementById("resetBtn");
const errorBox       = document.getElementById("errorBox");
const footerText     = document.getElementById("footerText");

// Settings elements
const settingsToggle = document.getElementById("settingsToggle");
const settingsArrow  = document.getElementById("settingsArrow");
const settingsBody   = document.getElementById("settingsBody");
const languageSelect = document.getElementById("languageSelect");
const endpointInput  = document.getElementById("endpointInput");
const saveSettingsBtn= document.getElementById("saveSettingsBtn");
const settingsSaved  = document.getElementById("settingsSaved");

// ─── State ───────────────────────────────────────────────────────────────────

let capturing   = false;
let slidesTabId = null;
let endpoint    = DEFAULT_ENDPOINT;
let language    = "";

// ─── Settings helpers ─────────────────────────────────────────────────────────

async function loadSettings() {
  const stored = await chrome.storage.local.get(["endpoint", "language"]);
  endpoint = stored.endpoint || DEFAULT_ENDPOINT;
  language = stored.language ?? "";

  endpointInput.value  = endpoint;
  languageSelect.value = language;
  updateFooter();
}

async function saveSettings() {
  endpoint = endpointInput.value.trim().replace(/\/$/, "") || DEFAULT_ENDPOINT;
  language = languageSelect.value;

  await chrome.storage.local.set({ endpoint, language });

  endpointInput.value = endpoint;
  updateFooter();

  // Flash "Saved!" feedback
  settingsSaved.style.display = "block";
  setTimeout(() => { settingsSaved.style.display = "none"; }, 1500);
}

function updateFooter() {
  try {
    const host = new URL(endpoint).host;
    footerText.textContent = `Endpoint: ${host} · Next.js app required`;
  } catch {
    footerText.textContent = `Endpoint: ${endpoint} · Next.js app required`;
  }
}

function getSlidesUrl() {
  return `${endpoint}/extension`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent   = "";
}

function setUI(isCapturing) {
  capturing = isCapturing;

  statusDot.classList.toggle("active", isCapturing);
  statusText.classList.toggle("active", isCapturing);
  statusText.textContent = isCapturing ? "Capturing tab audio…" : "Not capturing";

  captureBtn.classList.toggle("start", !isCapturing);
  captureBtn.classList.toggle("stop",  isCapturing);
  captureBtnIcon.textContent  = isCapturing ? "■" : "▶";
  captureBtnLabel.textContent = isCapturing ? "Stop Capture" : "Start Capture";
}

async function getSlidesTab() {
  const tabs = await chrome.tabs.query({ url: getSlidesUrl() + "*" });
  if (tabs.length > 0) {
    slidesTabId = tabs[0].id;
    slidesTabInfo.textContent = `Tab #${slidesTabId}`;
    return slidesTabId;
  }
  return null;
}

async function openOrFocusSlidesTab() {
  const existing = await getSlidesTab();
  if (existing) {
    await chrome.tabs.update(existing, { active: true });
    const tab = await chrome.tabs.get(existing);
    await chrome.windows.update(tab.windowId, { focused: true });
    return existing;
  }

  const tab = await chrome.tabs.create({ url: getSlidesUrl(), active: false });
  slidesTabId = tab.id;
  slidesTabInfo.textContent = `Tab #${slidesTabId} (new)`;

  // Wait for the page to finish loading
  await new Promise((resolve) => {
    function listener(tabId, info) {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 5000);
  });

  return slidesTabId;
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  clearError();

  await loadSettings();
  await getSlidesTab();

  chrome.runtime.sendMessage({ action: "getStatus" }, (resp) => {
    if (chrome.runtime.lastError) return;
    if (resp) {
      setUI(resp.capturing);
      if (resp.slidesTabId) {
        slidesTabId = resp.slidesTabId;
        slidesTabInfo.textContent = `Tab #${slidesTabId}`;
      }
    }
  });
}

// ─── Event handlers ──────────────────────────────────────────────────────────

// Settings toggle
settingsToggle.addEventListener("click", () => {
  const open = settingsBody.style.display === "none";
  settingsBody.style.display = open ? "flex" : "none";
  settingsArrow.classList.toggle("open", open);
});

saveSettingsBtn.addEventListener("click", saveSettings);

openSlidesBtn.addEventListener("click", async () => {
  openSlidesBtn.disabled = true;
  clearError();
  try {
    await openOrFocusSlidesTab();
  } catch (err) {
    showError("Could not open slides tab: " + err.message);
  } finally {
    openSlidesBtn.disabled = false;
  }
});

captureBtn.addEventListener("click", async () => {
  captureBtn.disabled = true;
  clearError();

  try {
    if (capturing) {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "stopCapture" }, (resp) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!resp?.ok) return reject(new Error(resp?.error || "Stop failed"));
          resolve();
        });
      });
      setUI(false);
    } else {
      const tabId = await openOrFocusSlidesTab();

      // Small delay to let content.js initialise in the newly loaded tab
      await new Promise((r) => setTimeout(r, 500));

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "startCapture",
            slidesTabId: tabId,
            language,
            endpoint,
          },
          (resp) => {
            if (chrome.runtime.lastError)
              return reject(new Error(chrome.runtime.lastError.message));
            if (!resp?.ok) return reject(new Error(resp?.error || "Capture failed"));
            resolve();
          }
        );
      });
      setUI(true);
    }
  } catch (err) {
    showError(err.message);
    chrome.runtime.sendMessage({ action: "getStatus" }, (resp) => {
      if (resp) setUI(resp.capturing);
    });
  } finally {
    captureBtn.disabled = false;
  }
});

resetBtn.addEventListener("click", () => {
  clearError();
  chrome.runtime.sendMessage({ action: "resetSlides" });
});

// ─── Run ─────────────────────────────────────────────────────────────────────

init();
