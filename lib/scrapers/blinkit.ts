import type { Page } from "playwright";
import type { CheckInput, PlatformResult } from "../types";
import { firstRupee, logArea, newPage, openContext, pageState, readProductLd } from "./browser";

const HOME = "https://blinkit.com/";

// the saved location lands during hydration, so give it a moment before deciding
async function locationIsSet(page: Page, pincode: string) {
  try {
    await page.waitForFunction(
      (pin) =>
        !!document
          .querySelector('[class*="LocationBar__Container"]')
          ?.textContent?.includes(pin),
      pincode,
      { timeout: 6000 },
    );
    return true;
  } catch {
    return false;
  }
}

export async function setPincode(page: Page, pincode: string) {
  if (page.url() === "about:blank" || !page.url().includes("blinkit.com")) {
    await page.goto(HOME, { waitUntil: "domcontentloaded" });
  }
  if (await locationIsSet(page, pincode)) return;

  // on a fresh profile Blinkit already shows the location picker, so only open it if hidden
  const input = page.locator('input[name="select-locality"]');
  if (!(await input.isVisible().catch(() => false))) {
    await page.locator('[class*="LocationBar__Container"]').first().click();
    await input.waitFor();
  }
  await input.fill(pincode);

  const row = page.locator('[class*="LocationSearchList__LocationListContainer"]').first();
  await row.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2000); // let the suggestion list settle before clicking
  await row.click();

  // assert on the location bar, not the body — the suggestion list also contains the pincode
  await page.waitForFunction(
    (pin) =>
      !!document
        .querySelector('[class*="LocationBar__Container"]')
        ?.textContent?.includes(pin),
    pincode,
    { timeout: 20_000 },
  );
  await logArea("blinkit", page, '[class*="LocationBar__Container"]');
}

// search cards are not links — they are role=button divs that navigate on click
async function resolveUrl(page: Page, input: CheckInput) {
  if (input.url) return input.url;
  await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(input.query!)}`, {
    waitUntil: "domcontentloaded",
  });
  // clicking the card itself does nothing — the product name is the navigation target
  // (font-semibold distinguishes it from the "Showing results for …" heading)
  const name = page
    .locator('[class*="tw-font-semibold"][class*="tw-line-clamp-2"]')
    .first();
  await name.waitFor({ timeout: 15_000 });
  await name.click();
  // client-side route change, so no load event to wait on
  await page.waitForFunction(() => location.pathname.includes("/prn/"), undefined, {
    timeout: 15_000,
  });
  return page.url();
}

export async function check(input: CheckInput): Promise<PlatformResult> {
  const ctx = await openContext("blinkit");
  const page = await newPage(ctx);
  try {
    await setPincode(page, input.pincode);

    const url = await resolveUrl(page, input);
    // reload with the location cookies in place so offers reflect this pincode
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // second guard: the product page shows the location too. If it does not match, the
    // page is priced for some other city and any stock reading off it is a lie.
    if (!(await locationIsSet(page, input.pincode))) {
      throw new Error(`pincode ${input.pincode} not applied on product page`);
    }

    // wait for the buy box specifically — a fixed sleep sometimes read the page before
    // it rendered, which looked like "no stock marker"
    await page.waitForFunction(
      () => /add to cart|out of stock|notify me|sold out/i.test(document.body.innerText),
      undefined,
      { timeout: 20_000 },
    );

    const ld = await readProductLd(page);
    const body = await page.locator("body").innerText();
    const hasAdd = /\badd to cart\b/i.test(body);
    const oos = /out of stock|notify me|sold out/i.test(body);

    // DOM decides, not ld+json — that block is SSR'd and CDN-cached per URL rather than
    // per location, so it can claim InStock for a city we are not looking at.
    if (!hasAdd && !oos) throw new Error("no stock marker on page");
    const status: PlatformResult["status"] = oos && !hasAdd ? "out_of_stock" : "in_stock";

    return {
      status,
      price: ld?.price ? `₹${ld.price}` : firstRupee(body),
      title: ld?.name ?? (await page.title()),
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
