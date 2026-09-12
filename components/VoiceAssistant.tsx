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
    recognition.continuous = false;
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
        void submit(final);
      }
    };

    recognition.onerror = () => {
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
    setStatus("listening");
    recognitionRef.current.start();
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
