import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { Platform } from "../types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export const HEADLESS = process.env.HEADED !== "1";

// One persistent profile per platform. This is what keeps the chosen location and the
// AWS WAF token around between runs — Instamart's location cookie is httpOnly so we
// cannot inject it, the profile is the only way.
// On Cloud Run this stays on the container's own disk (/tmp), never the mounted bucket —
// Chromium keeps SQLite files in here and those do not behave on GCS FUSE.
const PROFILE_ROOT =
  process.env.PROFILE_DIR ?? path.join(process.cwd(), "data", "profiles");

export async function openContext(platform: Platform): Promise<BrowserContext> {
  return chromium.launchPersistentContext(
    path.join(PROFILE_ROOT, platform),
    {
      headless: HEADLESS,
      userAgent: UA,
      viewport: { width: 1440, height: 900 },
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      args: [
        "--disable-blink-features=AutomationControlled",
        // Cloud Run runs us as root in a container with a tiny /dev/shm
        ...(process.env.CONTAINER === "1"
          ? ["--no-sandbox", "--disable-dev-shm-usage"]
          : []),
      ],
    },
  );
}

export async function newPage(ctx: BrowserContext): Promise<Page> {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.setDefaultTimeout(20_000);
  return page;
}

// Blinkit + Instamart both ship a Product ld+json whose offers reflect the picked location.
export async function readProductLd(
  page: Page,
): Promise<{ name?: string; price?: string; availability?: string } | null> {
  return page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    for (const s of scripts) {
      try {
        const j = JSON.parse(s.textContent || "");
        if (j?.["@type"] === "Product" && j.offers) {
          return {
            name: typeof j.name === "string" ? j.name : undefined,
            price: j.offers.price != null ? String(j.offers.price) : undefined,
            availability: j.offers.availability as string | undefined,
          };
        }
      } catch {
        // some of these blocks are empty or malformed, just skip
      }
    }
    return null;
  });
}

// A pincode like 560100 covers several areas, each served by a different dark store
// with its own stock. Log which one we actually landed on — otherwise "in stock" on one
// run and "sold out" on the next looks like a bug when it is two different stores.
export async function logArea(
  platform: Platform,
  page: Page,
  selector: string,
  // Instamart swaps out the address pill once a location is set, so fall back to
  // pulling the address out of the page text
  pattern?: RegExp,
) {
  let area = await page
    .locator(selector)
    .first()
    .textContent()
    .catch(() => null);

  if (!area?.trim() && pattern) {
    const body = await page.locator("body").innerText().catch(() => "");
    area = body.replace(/\s+/g, " ").match(pattern)?.[1] ?? null;
  }

  const clean = area?.replace(/\s+/g, " ").trim().slice(0, 90) || "unknown";
  console.log(`[area] ${platform} → ${clean}`);
}

// These run unattended, so a bare "locator timeout" tells us nothing. Attach what the
// page actually was — that is how you tell a markup change from a bot-block page.
export async function pageState(page: Page): Promise<string> {
  try {
    const title = await page.title();
    const body = (await page.locator("body").innerText())
      .replace(/\s+/g, " ")
      .slice(0, 300);
    return `url=${page.url()} | title="${title}" | body="${body}"`;
  } catch {
    return `url=${page.url()} | page unreadable`;
  }
}

export function firstRupee(text: string): string | undefined {
  const m = text.replace(/\s+/g, " ").match(/₹\s?([\d,]+(?:\.\d+)?)/);
  return m ? `₹${m[1]}` : undefined;
}
