import { config } from "dotenv";
import cron from "node-cron";
import { runAllChecks } from "./lib/checker";

// same file Next reads, so the UI and the worker share one config
config({ path: ".env.local" });
config();

const SCHEDULE = process.env.CRON ?? "*/30 * * * *";

let running = false;

async function run(trigger: string) {
  if (running) {
    console.log(`[worker] ${trigger} skipped — previous run still going`);
    return;
  }
  running = true;
  console.log(
    `[worker] ${trigger} run started at ${new Date().toLocaleString("en-IN")}`,
  );
  try {
    const summary = await runAllChecks();
    console.log(`[worker] done, ${summary.length} checks`);
  } catch (e) {
    console.error("[worker] run failed:", e);
  } finally {
    running = false;
  }
}

cron.schedule(SCHEDULE, () => run("cron"));
console.log(`[worker] scheduled "${SCHEDULE}" — running once now`);
run("boot");
