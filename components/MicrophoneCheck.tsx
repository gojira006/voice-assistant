"use client";

import { useEffect, useRef, useState } from "react";

type Device = { deviceId: string; label: string };

export default function MicrophoneCheck() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  async function loadDevices() {
    try {
      // Labels are only populated once permission has been granted, so
      // request it first with whatever the current default device is.
      const temp = await navigator.mediaDevices.getUserMedia({ audio: true });
      temp.getTracks().forEach((t) => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || "Unnamed microphone" }));

      setDevices(inputs);
      if (inputs.length > 0) setSelected(inputs[0].deviceId);
      setError(null);
    } catch {
      setError("Microphone access was denied, so devices can't be listed.");
    }
  }

  useEffect(() => {
    loadDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", loadDevices);
      stopMeter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopMeter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
    setLevel(0);
  }

  async function startMeter(deviceId: string) {
    stopMeter();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(100, Math.round((avg / 255) * 140)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setError(null);
    } catch {
      setError("Couldn't open that microphone.");
    }
  }

  function handleSelect(deviceId: string) {
    setSelected(deviceId);
    startMeter(deviceId);
  }

  return (
    <div className="mic-check">
      <div className="mic-check__row">
        <label htmlFor="mic-select" className="mic-check__label">
          Microphone
        </label>
        <select
          id="mic-select"
          value={selected}
          onChange={(e) => handleSelect(e.target.value)}
          className="mic-check__select"
        >
          {devices.length === 0 && <option>No microphones found</option>}
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        {streamRef.current ? (
          <button className="mic-check__stop" onClick={stopMeter}>
            Stop test
          </button>
        ) : (
          <button
            className="mic-check__stop"
            onClick={() => selected && startMeter(selected)}
            disabled={!selected}
          >
            Test
          </button>
        )}
      </div>

      <div className="mic-check__meter">
        <div className="mic-check__meter-fill" style={{ width: `${level}%` }} />
      </div>

      {error && <p className="mic-check__error">{error}</p>}
      {!error && (
        <p className="mic-check__hint">
          Speak and watch the bar to confirm this is the mic picking up your
          voice. The assistant itself always listens through your
          browser&apos;s default input — change that via the padlock icon in
          your address bar → Microphone, or your system&apos;s sound settings,
          if it&apos;s using the wrong one.
        </p>
      )}
    </div>
  );
}