"use client";

import { useEffect, useRef } from "react";

interface LiveTranscriptProps {
  finalTranscript: string;
  interimText: string;
  isListening: boolean;
}

export function LiveTranscript({
  finalTranscript,
  interimText,
  isListening,
}: LiveTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalTranscript, interimText]);

  const isEmpty = !finalTranscript && !interimText;

  return (
    <div className="flex flex-col gap-2 h-full">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Live Transcript
      </h2>
      <div className="flex-1 overflow-y-auto rounded-xl bg-gray-900 border border-gray-800 p-4 min-h-[120px] max-h-[260px]">
        {isEmpty ? (
          <p className="text-sm text-gray-600 italic">
            {isListening
              ? "Listening... start speaking."
              : "Start recording to see your transcript here."}
          </p>
        ) : (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {finalTranscript}
            {interimText && (
              <span className="text-gray-500 italic">{interimText}</span>
            )}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
