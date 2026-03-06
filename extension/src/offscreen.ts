/**
 * Offscreen document
 *
 * Responsibilities:
 * 1. Receive START_CAPTURE (streamId, language) from background
 * 2. Open tab audio stream via getUserMedia with chromeMediaSource: 'tab'
 * 3. Route audio through AudioContext so the user still hears the call
 * 4. Run SpeechRecognition on the captured stream
 * 5. Forward transcript updates back to background via chrome.runtime.sendMessage
 * 6. Receive STOP_CAPTURE and tear down everything
 */

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let recognition: SpeechRecognition | null = null;

let currentFinal = "";

function stopAll() {
  recognition?.stop();
  recognition = null;

  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  currentFinal = "";
}

async function startCapture(streamId: string, language: string) {
  stopAll();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-expect-error — Chrome-specific constraint
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    // Route through AudioContext so user still hears the Meet call
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(audioContext.destination);

    // Set up SpeechRecognition on the captured stream
    const SpeechRecognitionImpl =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) {
      throw new Error("SpeechRecognition not available in offscreen document");
    }

    recognition = new SpeechRecognitionImpl();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          currentFinal += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      chrome.runtime.sendMessage({
        type: "TRANSCRIPT_UPDATE",
        final: currentFinal.trim(),
        interim: interim.trim(),
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // network / no-speech are common transient errors — auto-restart
      if (event.error === "no-speech" || event.error === "network") {
        setTimeout(() => recognition?.start(), 500);
        return;
      }
      chrome.runtime.sendMessage({
        type: "TRANSCRIPT_UPDATE",
        final: currentFinal.trim(),
        interim: "",
        error: event.error,
      });
    };

    recognition.onend = () => {
      // Auto-restart unless stopAll() was called (recognition === null)
      if (recognition) recognition.start();
    };

    recognition.start();
  } catch (err) {
    chrome.runtime.sendMessage({
      type: "TRANSCRIPT_UPDATE",
      final: "",
      interim: "",
      error: err instanceof Error ? err.message : "Capture failed",
    });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_CAPTURE") {
    startCapture(msg.streamId as string, (msg.language as string) || "en-US");
  }
  if (msg.type === "STOP_CAPTURE") {
    stopAll();
  }
});
