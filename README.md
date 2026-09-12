# Signal — a zero-cost voice assistant

A voice assistant that runs entirely on free infrastructure: no paid APIs,
no subscriptions, no API keys.

- **Speech-to-text & text-to-speech** — the browser's built-in Web Speech
  API (`SpeechRecognition` / `SpeechSynthesis`). Free, no key, runs client-side.
- **Weather** — [Open-Meteo](https://open-meteo.com), a free forecast API
  that needs no API key.
- **Everything else** (time, date, jokes, math, notes) — handled locally in
  the browser, no network call at all.

Works best in **Chrome or Edge on desktop** — Web Speech API support is
inconsistent on Safari and on mobile browsers.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and click the signal to talk.

## Deploy to Vercel for free

1. Push this folder to a new GitHub repository.
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **Add New → Project**, select the repo, and click **Deploy**.
   Vercel auto-detects Next.js — no configuration needed.
4. No environment variables are required. The whole app runs on the
   free tier with no billing attached.

## Things you can say

- "What time is it?"
- "What's the weather in Cebu?"
- "Tell me a joke"
- "Calculate 42 times 8"
- "Remember that I need to submit my resume Friday"
- "What can you do?"

## Extending it

The intent-matching logic lives in `lib/commands.ts` — add new `if` blocks
there to teach the assistant new commands. If you eventually want more
open-ended conversation, the natural next step (still free) is running a
small local model with [Ollama](https://ollama.com) on your own machine
and calling it from a local API route — no cloud LLM subscription needed.
