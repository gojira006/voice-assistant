import VoiceAssistant from "@/components/VoiceAssistant";

export default function Home() {
  return (
    <main className="page">
      <header className="page__header">
        <h1>Signal</h1>
        <p className="page__sub">
          A voice assistant that costs nothing to run. Your browser handles
          the listening and the talking; a free weather lookup and a small
          set of local commands handle the rest. No subscriptions, no API
          keys, nothing metered.
        </p>
      </header>

      <VoiceAssistant />

      <footer className="page__footer">
        <p>
          Built on the browser&apos;s own speech tools and Open-Meteo&apos;s
          free forecast API.
        </p>
      </footer>
    </main>
  );
}
