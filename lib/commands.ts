// All handlers here are either fully local (no network) or call free,
// no-API-key services (Open-Meteo). Nothing here requires a subscription,
// an API key, or a billing account.

export type CommandResult = {
  reply: string;
};

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I told my computer I needed a break, and it said no problem, it'll go to sleep too.",
  "There are 10 types of people in the world: those who understand binary, and those who don't.",
  "Why did the developer go broke? Because he used up all his cache.",
  "A SQL query walks into a bar, walks up to two tables and asks, can I join you?",
];

function getNotes(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem("assistant-notes");
  return raw ? JSON.parse(raw) : [];
}

function saveNote(note: string) {
  const notes = getNotes();
  notes.push(note);
  window.localStorage.setItem("assistant-notes", JSON.stringify(notes));
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("no-geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
    });
  });
}

async function getWeatherByCoords(lat: number, lon: number): Promise<string> {
  try {
    const forecast = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`
    ).then((r) => r.json());

    const temp = forecast.current?.temperature_2m;
    const wind = forecast.current?.wind_speed_10m;

    let place = "your location";
    try {
      // Nominatim (OpenStreetMap) — free, no API key, used only to turn
      // coordinates into a readable place name.
      const rev = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      ).then((r) => r.json());
      place =
        rev.address?.city ||
        rev.address?.town ||
        rev.address?.village ||
        rev.address?.county ||
        place;
    } catch {
      // Reverse geocoding is a nice-to-have; fall back silently.
    }

    return `Right now near ${place}, it's about ${temp}°C with wind speeds near ${wind} kilometers per hour.`;
  } catch {
    return "I couldn't reach the weather service just now.";
  }
}

async function getWeather(city: string): Promise<string> {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1`
    ).then((r) => r.json());

    if (!geo.results || geo.results.length === 0) {
      return `I couldn't find a place called ${city}.`;
    }

    const { latitude, longitude, name, country } = geo.results[0];
    const forecast = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m`
    ).then((r) => r.json());

    const temp = forecast.current?.temperature_2m;
    const wind = forecast.current?.wind_speed_10m;
    return `Right now in ${name}, ${country}, it's about ${temp}°C with wind speeds near ${wind} kilometers per hour.`;
  } catch {
    return "I couldn't reach the weather service just now.";
  }
}

function safeMath(expression: string): string | null {
  // Only allow digits, operators, parentheses, decimal points, and spaces.
  const cleaned = expression.replace(/[^0-9+\-*/().\s]/g, "");
  if (!cleaned.trim()) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (typeof result === "number" && isFinite(result)) {
      return `${cleaned.trim()} is ${result}`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function handleCommand(rawText: string): Promise<CommandResult> {
  const text = rawText.trim().toLowerCase();

  if (!text) {
    return { reply: "I didn't catch that. Could you say it again?" };
  }

  if (/\b(hello|hi|hey)\b/.test(text)) {
    return { reply: "Hey there. What can I do for you?" };
  }

  if (/what.*(your name|are you)/.test(text)) {
    return {
      reply:
        "I'm a small offline-first voice assistant, built to run without any paid services.",
    };
  }

  if (/what.*(time)/.test(text)) {
    const now = new Date();
    return { reply: `It's ${now.toLocaleTimeString()} right now.` };
  }

  if (/what.*(date|day is it)/.test(text)) {
    const now = new Date();
    return {
      reply: `Today is ${now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`,
    };
  }

  const weatherMatch = text.match(/weather (?:in|for|at)\s+([a-z\s]+)/);
  if (weatherMatch) {
    const city = weatherMatch[1].trim();
    const reply = await getWeather(city);
    return { reply };
  }

  if (/weather/.test(text)) {
    try {
      const pos = await getCurrentPosition();
      const reply = await getWeatherByCoords(
        pos.coords.latitude,
        pos.coords.longitude
      );
      return { reply };
    } catch {
      return {
        reply:
          "I need location access to check the weather near you — allow location access, or ask for a specific city instead, like 'weather in Cebu'.",
      };
    }
  }

  if (/tell me a joke|make me laugh|joke/.test(text)) {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    return { reply: joke };
  }

  const mathMatch = text.match(
    /(?:calculate|what is|what's|compute)\s+([0-9+\-*/().\s]+)/
  );
  if (mathMatch) {
    const result = safeMath(mathMatch[1]);
    return {
      reply: result ?? "I couldn't work that one out — try a simpler expression.",
    };
  }

  const noteMatch = text.match(/(?:note|remember)\s+(?:that\s+)?(.+)/);
  if (noteMatch) {
    saveNote(noteMatch[1]);
    return { reply: `Got it, I saved that note.` };
  }

  if (/(read|show|list).*(notes|note)/.test(text)) {
    const notes = getNotes();
    if (notes.length === 0) return { reply: "You don't have any notes saved yet." };
    return { reply: `Here's what you've saved: ${notes.join(". ")}.` };
  }

  if (/what can you do|help/.test(text)) {
    return {
      reply:
        "You can ask me for the time or date, the weather near you or in a specific city, a joke, a quick calculation, or ask me to remember a note.",
    };
  }

  if (/thank/.test(text)) {
    return { reply: "Anytime." };
  }

  return {
    reply:
      "I'm not sure how to help with that yet. Try asking for the time, the weather, a joke, or a calculation.",
  };
}