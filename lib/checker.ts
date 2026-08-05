import { readSnapshot, saveWatches } from "./store";
import { sendMessage } from "./telegram";
import { PLATFORM_LABELS, type CheckInput, type Platform, type PlatformResult } from "./types";
import { check as blinkit } from "./scrapers/blinkit";
import { check as instamart } from "./scrapers/instamart";
import { check as zepto } from "./scrapers/zepto";

export const SCRAPERS: Record<Platform, (i: CheckInput) => Promise<PlatformResult>> = {
  blinkit,
  zepto,
  instamart,
};

export async function runAllChecks() {
  const snapshot = await readSnapshot();
  const watches = snapshot.watches;
  const summary: { platform: Platform; status: string }[] = [];

  for (const w of watches) {
    let result: PlatformResult;
    try {
      result = await SCRAPERS[w.platform]({ url: w.url, pincode: w.pincode });
    } catch (e) {
      result = { status: "error", error: e instanceof Error ? e.message : String(e) };
      console.error(`[check] ${w.platform} · ${w.url} failed:`, result.error);
    }

    const justRestocked = result.status === "in_stock" && w.result?.status !== "in_stock";
    let notifiedAt = result.status === "in_stock" ? w.result?.notifiedAt : undefined;

    if (justRestocked) {
      const text = [
        `🟢 <b>IN STOCK</b> — ${result.title ?? w.url}`,
        `${PLATFORM_LABELS[w.platform]} · ${result.price ?? "price n/a"} · ${w.pincode}`,
        w.url,
      ].join("\n");
      const sent = await sendMessage(w.chatId, text);
      // leave notifiedAt unset if the send failed, so the next run retries the ping
      if (sent) notifiedAt = new Date().toISOString();
      console.log(
        `[check] ${w.platform} → RESTOCKED, ${sent ? `pinged ${w.chatId}` : "ping FAILED"}`,
      );
    }

    w.result = { ...result, checkedAt: new Date().toISOString(), notifiedAt };
    summary.push({ platform: w.platform, status: result.status });
    console.log(`[check] ${w.platform} → ${result.status} ${result.price ?? ""}`);
  }

  // one write for the whole run, not one per watch — on the GitHub backend that is
  // one commit instead of three
  if (watches.length) {
    await saveWatches(snapshot, watches, `check: ${summary.map((s) => s.status).join(", ")}`);
  }
  return summary;
}
