// Single check pass, then exit. This is what the Cloud Run job runs — Cloud Scheduler
// is the cron up there, so node-cron (worker.ts) is only for running locally.
import { config } from "dotenv";
import { runAllChecks } from "../lib/checker";

config({ path: ".env.local" });
config();

async function main() {
  const started = Date.now();
  const summary = await runAllChecks();
  console.log(`[run-once] ${summary.length} checks in ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((e) => {
  console.error("[run-once] failed:", e);
  process.exit(1);
});
