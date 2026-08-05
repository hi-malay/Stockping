import { readWatches, saveResult } from "./store";
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

type Job = { watchId: string; label: string; chatId: string; pincode: string; input: CheckInput };

function jobsFor(platform: Platform): Job[] {
  const jobs: Job[] = [];
  for (const w of readWatches()) {
    if (!w.platforms.includes(platform)) continue;
    const url = w.urls?.[platform];
    if (!url && !w.query) continue;
    jobs.push({
      watchId: w.id,
      label: w.label,
      chatId: w.chatId,
      pincode: w.pincode,
      input: { pincode: w.pincode, url, query: url ? undefined : w.query },
    });
  }
  return jobs;
}

function message(job: Job, platform: Platform, r: PlatformResult) {
  const title = r.title || job.label;
  return [
    `🟢 <b>IN STOCK</b> — ${title}`,
    `${PLATFORM_LABELS[platform]} · ${r.price ?? "price n/a"} · ${job.pincode}`,
    r.url ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runAllChecks() {
  const summary: { platform: Platform; label: string; status: string }[] = [];

  // grouped by platform: one browser profile per platform per run, fewer WAF challenges
  for (const platform of Object.keys(SCRAPERS) as Platform[]) {
    const jobs = jobsFor(platform);
    if (!jobs.length) continue;

    for (const job of jobs) {
      const prev = readWatches().find((w) => w.id === job.watchId)?.results[platform];
      let result: PlatformResult;
      try {
        result = await SCRAPERS[platform](job.input);
      } catch (e) {
        result = { status: "error", error: e instanceof Error ? e.message : String(e) };
        console.error(`[check] ${platform} · ${job.label} failed:`, result.error);
      }

      const justRestocked = result.status === "in_stock" && prev?.status !== "in_stock";
      let notifiedAt = result.status === "in_stock" ? prev?.notifiedAt : undefined;

      if (justRestocked) {
        const sent = await sendMessage(job.chatId, message(job, platform, result));
        // leave notifiedAt unset if the send failed, so the next run retries the ping
        if (sent) notifiedAt = new Date().toISOString();
        console.log(
          `[check] ${platform} · ${job.label} → RESTOCKED, ${
            sent ? `pinged ${job.chatId}` : "ping FAILED"
          }`,
        );
      }

      saveResult(job.watchId, platform, {
        ...result,
        checkedAt: new Date().toISOString(),
        notifiedAt,
      });
      summary.push({ platform, label: job.label, status: result.status });
      console.log(`[check] ${platform} · ${job.label} → ${result.status} ${result.price ?? ""}`);
    }
  }

  return summary;
}
