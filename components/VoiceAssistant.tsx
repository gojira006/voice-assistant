"use client";

import { useEffect, useRef, useState } from "react";
import { handleCommand } from "@/lib/commands";

type LogEntry = {
  role: "you" | "assistant";
  text: string;
};

type Status = "idle" | "listening" | "thinking" | "speaking" | "unsupported";

export default function VoiceAssistant() {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [liveText, setLiveText] = useState("");
  const [recError, setRecError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("unsupported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setLiveText(interim || final);
      if (final) {
        // We have a full sentence — stop listening ourselves rather than
        // waiting for the browser's own silence detection, which can be
        // unreliable (it may keep listening indefinitely, or cut off early).
        recognitionRef.current?.stop();
        void submit(final);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setRecError(describeError(event.error));
      setStatus("idle");
    };

    recognition.onend = () => {
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;
  }, []);

  async function submit(text: string) {
    setStatus("thinking");
    setLog((prev) => [...prev, { role: "you", text }]);
    setLiveText("");

    const { reply } = await handleCommand(text);

    setLog((prev) => [...prev, { role: "assistant", text: reply }]);
    speak(reply);
  }

  function speak(text: string) {
    const synth = window.speechSynthesis;
    if (!synth) {
      setStatus("idle");
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("idle");
    synth.speak(utterance);
  }

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (status === "listening") {
      recognitionRef.current.stop();
      setStatus("idle");
      return;
    }
    window.speechSynthesis?.cancel();
    setRecError(null);
    setStatus("listening");
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Failed to start recognition:", err);
      setRecError(describeError(err?.message || "start-failed"));
      setStatus("idle");
    }
  }

  if (status === "unsupported") {
    return (
      <div className="panel">
        <p>
          Your browser doesn&apos;t support the Web Speech API. Try this in
          Chrome or Edge on desktop.
        </p>
      </div>
    );
  }

  return (
    <div className="assistant">
      <button
        className={`signal signal--${status}`}
        onClick={toggleListening}
        aria-label={status === "listening" ? "Stop listening" : "Start listening"}
      >
        <span className="signal__ring signal__ring--1" />
        <span className="signal__ring signal__ring--2" />
        <span className="signal__ring signal__ring--3" />
        <span className="signal__core" />
      </button>

      <p className="status-line">{statusLabel(status)}</p>

      {recError && <p className="live-text" style={{ color: "#e08484" }}>{recError}</p>}

      {liveText && <p className="live-text">&ldquo;{liveText}&rdquo;</p>}

      <div className="transcript" role="log">
        {log.length === 0 && (
          <p className="transcript__empty">
            Tap the signal and try: &ldquo;what&apos;s the weather in
            Manila&rdquo;, &ldquo;tell me a joke&rdquo;, or &ldquo;what time is
            it&rdquo;.
          </p>
        )}
        {log.map((entry, i) => (
          <p key={i} className={`transcript__line transcript__line--${entry.role}`}>
            <span className="transcript__tag">
              {entry.role === "you" ? "you" : "assistant"}
            </span>
            {entry.text}
          </p>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: Status) {
  switch (status) {
    case "listening":
      return "listening…";
    case "thinking":
      return "thinking…";
    case "speaking":
      return "speaking…";
    default:
      return "tap to talk";
  }
}

function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "permission-denied":
      return "Microphone permission was blocked. Allow it via the padlock icon in your address bar.";
    case "no-speech":
      return "No speech was detected — try again and speak right after tapping.";
    case "audio-capture":
      return "No microphone was found. Check that one is connected and selected as your system default.";
    case "network":
      return "Speech recognition needs an internet connection to reach the browser's speech service, and it couldn't connect.";
    case "service-not-allowed":
      return "The browser blocked access to its speech recognition service.";
    default:
      return `Speech recognition error: ${code}`;
  }
}