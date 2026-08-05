import type { Page } from "playwright";
import type { CheckInput, PlatformResult } from "../types";
import { firstRupee, logArea, newPage, openContext, pageState, readProductLd } from "./browser";

const HOME = "https://blinkit.com/";
const LOCATION_BAR = '[class*="LocationBar__Container"]';

// the saved location lands during hydration, so give it a moment before deciding
async function locationIsSet(page: Page, pincode: string) {
  try {
    await page.waitForFunction(
      ([sel, pin]) => !!document.querySelector(sel)?.textContent?.includes(pin),
      [LOCATION_BAR, pincode],
      { timeout: 6000 },
    );
    return true;
  } catch {
    return false;
  }
}

async function setPincode(page: Page, pincode: string) {
  await page.goto(HOME, { waitUntil: "domcontentloaded" });
  if (await locationIsSet(page, pincode)) return;

  // on a fresh profile Blinkit already shows the location picker, so only open it if hidden
  const input = page.locator('input[name="select-locality"]');
  if (!(await input.isVisible().catch(() => false))) {
    await page.locator(LOCATION_BAR).first().click();
    await input.waitFor();
  }
  await input.fill(pincode);

  const row = page.locator('[class*="LocationSearchList__LocationListContainer"]').first();
  await row.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2000); // let the suggestion list settle before clicking
  await row.click();

  if (!(await locationIsSet(page, pincode))) {
    throw new Error(`pincode ${pincode} did not apply`);
  }
  await logArea("blinkit", page, LOCATION_BAR);
}

export async function check({ url, pincode }: CheckInput): Promise<PlatformResult> {
  const ctx = await openContext("blinkit");
  const page = await newPage(ctx);
  try {
    await setPincode(page, pincode);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // the product page carries the location too — if it does not match, the page is
    // priced for another city and any stock reading off it is a lie
    if (!(await locationIsSet(page, pincode))) {
      throw new Error(`pincode ${pincode} not applied on product page`);
    }

    // wait for the buy box specifically; a fixed sleep sometimes read the page too early
    await page.waitForFunction(
      () => /add to cart|out of stock|notify me|sold out/i.test(document.body.innerText),
      undefined,
      { timeout: 20_000 },
    );

    const body = await page.locator("body").innerText();
    const hasAdd = /\badd to cart\b/i.test(body);

    // The DOM decides, never ld+json — that block is SSR'd and CDN-cached per URL rather
    // than per location, so it happily claims InStock for a city we are not looking at.
    const ld = await readProductLd(page);
    return {
      status: hasAdd ? "in_stock" : "out_of_stock",
      price: ld?.price ? `₹${ld.price}` : firstRupee(body),
      title: ld?.name ?? (await page.title()),
    };
  } catch (e) {
    throw new Error(`${e instanceof Error ? e.message : String(e)} || ${await pageState(page)}`);
  } finally {
    await ctx.close();
  }
}
