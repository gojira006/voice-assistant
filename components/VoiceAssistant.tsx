"use client";

import { useEffect, useRef, useState } from "react";
import { handleCommand } from "@/lib/commands";

type LogEntry = {
  role: "you" | "assistant";
  text: string;
};

type Status = "idle" | "listening" | "thinking" | "speaking" | "unsupported";

const BAR_COUNT = 5;

export default function VoiceAssistant() {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [liveText, setLiveText] = useState("");
  const [recError, setRecError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(new Array(BAR_COUNT).fill(4));

  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

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
        recognitionRef.current?.stop();
        void submit(final);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setRecError(describeError(event.error));
      setStatus("idle");
      stopWaveform();
    };

    recognition.onend = () => {
      setStatus((s) => (s === "listening" ? "idle" : s));
      stopWaveform();
    };

    recognitionRef.current = recognition;

    return () => stopWaveform();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, liveText]);

  async function startWaveform() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const chunk = Math.floor(data.length / BAR_COUNT);
        const next = new Array(BAR_COUNT).fill(0).map((_, i) => {
          const slice = data.slice(i * chunk, (i + 1) * chunk);
          const avg = slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
          return Math.max(4, Math.min(32, Math.round((avg / 255) * 32)));
        });
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Waveform is cosmetic — if we can't get a stream here, recognition
      // will still surface its own error separately.
    }
  }

  function stopWaveform() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    rafRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    setLevels(new Array(BAR_COUNT).fill(4));
  }

  async function submit(text: string) {
    stopWaveform();
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
      stopWaveform();
      return;
    }
    window.speechSynthesis?.cancel();
    setRecError(null);
    setStatus("listening");
    startWaveform();
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Failed to start recognition:", err);
      setRecError(describeError(err?.message || "start-failed"));
      setStatus("idle");
      stopWaveform();
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
      <div className={`signal-wrap signal-wrap--${status}`}>
        <span className="signal-glow" />
        <button
          className={`signal signal--${status}`}
          onClick={toggleListening}
          aria-label={status === "listening" ? "Stop listening" : "Start listening"}
        >
          <span className="signal__ring signal__ring--1" />
          <span className="signal__ring signal__ring--2" />
          <span className="signal__ring signal__ring--3" />

          {status === "listening" ? (
            <span className="waveform" aria-hidden="true">
              {levels.map((h, i) => (
                <span key={i} className="waveform__bar" style={{ height: `${h}px` }} />
              ))}
            </span>
          ) : (
            <span className="signal__core" />
          )}
        </button>
      </div>

      <p className="status-line">
        {status === "thinking" ? (
          <span className="thinking-dots">
            <span />
            <span />
            <span />
          </span>
        ) : (
          statusLabel(status)
        )}
      </p>

      {recError && (
        <p className="live-text live-text--error">{recError}</p>
      )}

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
          <p
            key={i}
            className={`transcript__line transcript__line--${entry.role} transcript__line--enter`}
          >
            <span className="transcript__tag">
              {entry.role === "you" ? "you" : "assistant"}
            </span>
            {entry.text}
          </p>
        ))}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}

function statusLabel(status: Status) {
  switch (status) {
    case "listening":
      return "listening…";
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