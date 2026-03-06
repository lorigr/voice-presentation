/**
 * Popup script
 *
 * Handles:
 * - Load / save config (apiBaseUrl, model, language) in chrome.storage.sync
 * - START / STOP / RESET messages to background
 * - Status display reflecting extensionState from chrome.storage.local
 * - Opening the slide window (chrome.windows.create)
 */

const dot = document.getElementById("dot") as HTMLElement;
const toggleBtn = document.getElementById("toggleBtn") as HTMLButtonElement;
const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
const slideWindowBtn = document.getElementById("slideWindowBtn") as HTMLButtonElement;
const apiBaseUrlInput = document.getElementById("apiBaseUrl") as HTMLInputElement;
const modelSelect = document.getElementById("model") as HTMLSelectElement;
const statusText = document.getElementById("status-text") as HTMLElement;
const langButtons = document.querySelectorAll<HTMLButtonElement>(".lang-btn");

let isCapturing = false;
let slideWindowId: number | null = null;

// ── Load config ───────────────────────────────────────────────────────────────

chrome.storage.sync.get(
  { apiBaseUrl: "http://localhost:3000", model: "openai/gpt-4o-mini", language: "en-US" },
  (config) => {
    apiBaseUrlInput.value = config.apiBaseUrl as string;
    modelSelect.value = config.model as string;
    setLanguage(config.language as string);
  },
);

// ── Load current state from background ───────────────────────────────────────

chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
  if (state) applyState(state);
});

// ── Config change listeners ───────────────────────────────────────────────────

apiBaseUrlInput.addEventListener("change", () => saveConfig());
modelSelect.addEventListener("change", () => saveConfig());

function saveConfig() {
  const lang = getSelectedLanguage();
  chrome.storage.sync.set({
    apiBaseUrl: apiBaseUrlInput.value.trim(),
    model: modelSelect.value,
    language: lang,
  });
}

// ── Language toggle ───────────────────────────────────────────────────────────

function getSelectedLanguage(): string {
  for (const btn of langButtons) {
    if (btn.classList.contains("selected")) return btn.dataset.lang ?? "en-US";
  }
  return "en-US";
}

function setLanguage(lang: string) {
  for (const btn of langButtons) {
    btn.classList.toggle("selected", btn.dataset.lang === lang);
  }
}

langButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setLanguage(btn.dataset.lang ?? "en-US");
    saveConfig();
  });
});

// ── Toggle Start / Stop ───────────────────────────────────────────────────────

toggleBtn.addEventListener("click", () => {
  if (isCapturing) {
    chrome.runtime.sendMessage({ type: "STOP" }, () => {
      setStatus("idle");
    });
  } else {
    setStatus("starting");
    toggleBtn.disabled = true;
    chrome.runtime.sendMessage({ type: "START" }, (resp) => {
      toggleBtn.disabled = false;
      if (!resp?.ok) {
        setStatus("error", resp?.error ?? "Failed to start");
      }
    });
  }
});

resetBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESET" }, () => {
    setStatus("idle");
  });
});

// ── Slide window ──────────────────────────────────────────────────────────────

slideWindowBtn.addEventListener("click", () => {
  const base = apiBaseUrlInput.value.trim() || "http://localhost:3000";
  const url = `${base.replace(/\/$/, "")}/?mode=extension`;

  // If already open, focus it
  if (slideWindowId !== null) {
    chrome.windows.update(slideWindowId, { focused: true }, (win) => {
      if (chrome.runtime.lastError || !win) {
        openSlideWindow(url);
      }
    });
  } else {
    openSlideWindow(url);
  }
});

function openSlideWindow(url: string) {
  chrome.windows.create(
    { url, type: "popup", width: 1280, height: 720, focused: true },
    (win) => {
      if (win?.id) slideWindowId = win.id;
    },
  );
}

// ── Storage listener (background pushes state updates via storage) ────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.extensionState) {
    applyState(changes.extensionState.newValue);
  }
});

// ── State rendering ───────────────────────────────────────────────────────────

function applyState(state: {
  isCapturing: boolean;
  isGenerating: boolean;
  error: string | null;
}) {
  isCapturing = state.isCapturing;

  if (state.error) {
    setStatus("error", state.error);
  } else if (state.isGenerating) {
    setStatus("generating");
  } else if (state.isCapturing) {
    setStatus("capturing");
  } else {
    setStatus("idle");
  }
}

type Status = "idle" | "starting" | "capturing" | "generating" | "error";

function setStatus(status: Status, message?: string) {
  dot.className = "status-dot";
  statusText.className = "";
  statusText.textContent = "";

  switch (status) {
    case "idle":
      toggleBtn.textContent = "Start";
      break;
    case "starting":
      dot.classList.add("working");
      toggleBtn.textContent = "Starting…";
      statusText.textContent = "Requesting tab capture…";
      break;
    case "capturing":
      dot.classList.add("active");
      toggleBtn.textContent = "Stop";
      statusText.textContent = "Listening…";
      break;
    case "generating":
      dot.classList.add("working");
      toggleBtn.textContent = "Stop";
      statusText.textContent = "Generating slides…";
      break;
    case "error":
      dot.classList.add("error");
      toggleBtn.textContent = isCapturing ? "Stop" : "Start";
      statusText.className = "error-text";
      statusText.textContent = message ?? "Error";
      break;
  }
}
