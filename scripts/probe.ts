// Dev helper: run one scraper against one URL (or search term) and print what it found.
//   npx tsx scripts/probe.ts blinkit https://blinkit.com/prn/.../prid/771901
//   HEADED=1 npx tsx scripts/probe.ts zepto "hot wheels"
import { SCRAPERS } from "../lib/checker";
import { PLATFORMS, type Platform } from "../lib/types";

const [platform, target, pincode = "560100"] = process.argv.slice(2);

if (!PLATFORMS.includes(platform as Platform) || !target) {
  console.error(`usage: tsx scripts/probe.ts <${PLATFORMS.join("|")}> <url|query> [pincode]`);
  process.exit(1);
}

const input = target.startsWith("http") ? { url: target } : { query: target };

console.log(`[probe] ${platform} · ${pincode} ·`, input);
const t0 = Date.now();
SCRAPERS[platform as Platform]({ pincode, ...input })
  .then((r) => console.log(`[probe] done in ${Math.round((Date.now() - t0) / 1000)}s`, r))
  .catch((e) => {
    console.error("[probe] failed:", e);
    process.exit(1);
  });
