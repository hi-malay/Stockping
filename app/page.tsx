import { readWatches } from "@/lib/store";
import WatchList from "./watch-list";

// read straight off the JSON file on the server, no client fetch on mount
export const dynamic = "force-dynamic";

export default async function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6 font-sans">
      <h1 className="text-2xl font-bold">Stockping</h1>
      <p className="mt-1 text-sm text-gray-500">
        Watches Blinkit, Zepto and Instamart every 30 min and pings you on
        Telegram the moment something is back in stock at your pincode.
      </p>
      <WatchList
        initial={await readWatches()}
        defaultChatId={process.env.DEFAULT_TELEGRAM_CHAT_ID ?? ""}
        // Playwright cannot run on Vercel, so checks only happen on the GCP cron there
        canCheckNow={!process.env.VERCEL}
      />
    </main>
  );
}
