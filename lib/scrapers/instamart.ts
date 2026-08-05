import type { Page } from "playwright";
import type { CheckInput, PlatformResult } from "../types";
import { firstRupee, logArea, newPage, openContext, pageState, readProductLd } from "./browser";

const HOME = "https://www.instamart.in/";

async function locationIsSet(page: Page, pincode: string) {
  try {
    await page.waitForFunction(
      (pin) => {
        const t = document.body.innerText;
        return t.includes("Delivery to") && t.includes(pin);
      },
      pincode,
      { timeout: 6000 },
    );
    return true;
  } catch {
    return false;
  }
}

// The /item/<id> page has no location UI at all, so the pincode has to be set on the
// home page first. Note: this flow has an extra map "Confirm Location" step.
export async function setPincode(page: Page, pincode: string) {
  await page.goto(HOME, { waitUntil: "domcontentloaded" });
  if (await locationIsSet(page, pincode)) return;

  // on a fresh profile Instamart pops the address modal by itself — clicking the pill
  // then fails because the modal overlay swallows the pointer events
  const searchEntry = page.getByText("Search for an area or address").first();
  if (!(await searchEntry.isVisible().catch(() => false))) {
    await page.locator('[data-testid="DEFAULT_ADDRESS_TITLE"]').first().click();
    await searchEntry.waitFor({ timeout: 10_000 });
  }
  await searchEntry.click();

  const input = page.locator('input[placeholder="Search for area, street name…"]');
  await input.waitFor({ timeout: 10_000 });
  await input.fill(pincode);

  const row = page.getByText(pincode, { exact: false }).nth(1);
  await row.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await row.click();

  const confirm = page.getByRole("button", { name: "Confirm Location" });
  await confirm.waitFor({ timeout: 15_000 });
  await confirm.click();

  // Must assert on the "Delivery to …" header, NOT on the body — the address modal
  // itself contains the pincode, so a body check passes even when the location never
  // applied. That is how a false "in stock ₹179" ping got sent from Cloud Run.
  if (!(await locationIsSet(page, pincode))) {
    throw new Error(`pincode ${pincode} did not apply`);
  }
  await logArea(
    "instamart",
    page,
    '[data-testid="DEFAULT_ADDRESS_TITLE"]',
    /Delivery to (.{5,120}?) (?:Search for|Sign in)/,
  );
}

// search cards are not links either — click the card and read where it lands
async function resolveUrl(page: Page, input: CheckInput) {
  if (input.url) return input.url;
  await page.goto(`${HOME}search?custom_back=true&query=${encodeURIComponent(input.query!)}`, {
    waitUntil: "domcontentloaded",
  });
  const card = page.locator('[data-testid="item-collection-card-full"]').first();
  await card.waitFor({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/\/item\//, { timeout: 15_000 });
  return page.url();
}

export async function check(input: CheckInput): Promise<PlatformResult> {
  const ctx = await openContext("instamart");
  const page = await newPage(ctx);
  try {
    await setPincode(page, input.pincode);

    const url = await resolveUrl(page, input);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // wait for the buy box rather than sleeping a fixed amount
    await page.waitForFunction(
      () => /\bADD\b|sold out/i.test(document.body.innerText),
      undefined,
      { timeout: 20_000 },
    );

    const ld = await readProductLd(page);
    const body = await page.locator("body").innerText();

    // Do NOT trust ld+json availability here. It is baked into the SSR HTML and cached
    // by the CDN per URL, not per location, so the same product URL served InStock to
    // Cloud Run and OutOfStock locally at the very same pincode. Only the hydrated DOM
    // reflects the chosen store. Price/name from ld+json are fine.
    const soldOut =
      (await page.locator('[data-testid="sold-out"]').count().catch(() => 0)) > 0 ||
      /sold out/i.test(body);
    const canAdd =
      (await page.getByText(/^ADD$/).count().catch(() => 0)) > 0 ||
      /\bADD\b/.test(body);

    // demand a positive signal either way — "neither marker present" means the page
    // never hydrated, and guessing in_stock there is how you get a false ping
    if (!soldOut && !canAdd) throw new Error("no stock marker on page");
    const status: PlatformResult["status"] = soldOut ? "out_of_stock" : "in_stock";

    return {
      status,
      price: ld?.price ? `₹${ld.price}` : firstRupee(body),
      title: ld?.name?.replace(/&amp;/g, "&") ?? (await page.title()),
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
