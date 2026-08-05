import type { Page } from "playwright";
import type { CheckInput, PlatformResult } from "../types";
import { firstRupee, logArea, newPage, openContext, pageState } from "./browser";

const HOME = "https://www.zepto.com/";

// The saved location comes from localStorage during hydration, so give it a moment —
// checking too early sees the SSR'd "Select Location" and we'd redo the whole flow.
async function locationIsSet(page: Page, pincode: string) {
  try {
    await page.waitForFunction(
      (pin) => !!document.querySelector("header")?.textContent?.includes(pin),
      pincode,
      { timeout: 6000 },
    );
    return true;
  } catch {
    return false;
  }
}

export async function setPincode(page: Page, pincode: string) {
  if (!page.url().includes("zepto")) {
    await page.goto(HOME, { waitUntil: "domcontentloaded" });
  }
  if (await locationIsSet(page, pincode)) return;

  // on a fresh profile the modal sometimes opens by itself, and then the pill is
  // behind the overlay — only click it if the address input isn't already there
  const input = page.locator('input[placeholder="Search a new address"]');
  if (!(await input.isVisible().catch(() => false))) {
    await page.locator('button[aria-label="Select Location"]').first().click();
    await input.waitFor();
  }
  await input.fill(pincode);

  // suggestion rows have hashed class names, so match on the text instead
  const row = page.locator(`text=/^${pincode},/`).first();
  await row.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2500); // let the suggestion list settle, else the click lands on a stale row
  await row.click();

  // assert on the header, not the body — the suggestion list itself contains the pincode
  await page.waitForFunction(
    (pin) => !!document.querySelector("header")?.textContent?.includes(pin),
    pincode,
    { timeout: 20_000 },
  );
  await logArea("zepto", page, "header");
}

async function resolveUrl(page: Page, input: CheckInput) {
  if (input.url) return input.url;
  await page.goto(`${HOME}search?query=${encodeURIComponent(input.query!)}`, {
    waitUntil: "domcontentloaded",
  });
  const link = page.locator('a[href*="/pvid/"]').first();
  await link.waitFor({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  if (!href) throw new Error("no search result");
  return new URL(href, HOME).toString();
}

export async function check(input: CheckInput): Promise<PlatformResult> {
  const ctx = await openContext("zepto");
  const page = await newPage(ctx);
  try {
    await setPincode(page, input.pincode);

    const url = await resolveUrl(page, input);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // second guard: the product page shows the location too. If it does not match, the
    // page is priced for some other city and any stock reading off it is a lie.
    if (!(await locationIsSet(page, input.pincode))) {
      throw new Error(`pincode ${input.pincode} not applied on product page`);
    }

    // Zepto has no Product ld+json — the Add to Cart button is the signal
    const body = await page.locator("body").innerText();
    const addBtn = await page
      .locator('button:has-text("Add to Cart")')
      .count()
      .catch(() => 0);
    const oos = /out of stock|notify me|sold out/i.test(body);

    // first ₹ in the body is the selling price (header carries no price on Zepto);
    // title is the fallback — it reads "… - Buy at ₹334 Online"
    const title = await page.title();
    const price = firstRupee(body) ?? firstRupee(title);

    return {
      status: addBtn > 0 && !oos ? "in_stock" : "out_of_stock",
      price,
      title: title.split(" - Buy")[0],
      url,
    };
  } catch (e) {
    throw new Error(
      `${e instanceof Error ? e.message : String(e)} || ${await pageState(page)}`,
    );
  } finally {
    await ctx.close();
  }
}
