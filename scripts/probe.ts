// Dev helper: run one product URL and print what it found.
//   npx tsx scripts/probe.ts https://blinkit.com/prn/.../prid/771901
//   HEADED=1 npx tsx scripts/probe.ts <url> 560100
import { SCRAPERS } from "../lib/checker";
import { platformFromUrl } from "../lib/types";

const [url, pincode = "560100"] = process.argv.slice(2);
const platform = url ? platformFromUrl(url) : null;

if (!platform) {
  console.error("usage: tsx scripts/probe.ts <blinkit|zepto|instamart product url> [pincode]");
  process.exit(1);
}

console.log(`[probe] ${platform} · ${pincode} · ${url}`);
const t0 = Date.now();
SCRAPERS[platform]({ url, pincode })
  .then((r) => console.log(`[probe] done in ${Math.round((Date.now() - t0) / 1000)}s`, r))
  .catch((e) => {
    console.error("[probe] failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
