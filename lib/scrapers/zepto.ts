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

async function setPincode(page: Page, pincode: string) {
  await page.goto(HOME, { waitUntil: "domcontentloaded" });
  if (await locationIsSet(page, pincode)) return;

  // on a fresh profile the modal sometimes opens by itself, and then the pill sits
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
  await page.waitForTimeout(2500); // let the list settle, else the click lands on a stale row
  await row.click();

  // assert on the header, not the body — the suggestion list contains the pincode too
  if (!(await locationIsSet(page, pincode))) {
    throw new Error(`pincode ${pincode} did not apply`);
  }
  await logArea("zepto", page, "header");
}

export async function check({ url, pincode }: CheckInput): Promise<PlatformResult> {
  const ctx = await openContext("zepto");
  const page = await newPage(ctx);
  try {
    await setPincode(page, pincode);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    if (!(await locationIsSet(page, pincode))) {
      throw new Error(`pincode ${pincode} not applied on product page`);
    }

    // Zepto has no Product ld+json, so the buy box is the only signal
    await page.waitForFunction(
      () => /add to cart|out of stock|notify me|sold out/i.test(document.body.innerText),
      undefined,
      { timeout: 20_000 },
    );

    const body = await page.locator("body").innerText();
    const title = await page.title();

    return {
      status: /add to cart/i.test(body) ? "in_stock" : "out_of_stock",
      // first ₹ in the body is the selling price; the header carries no price on Zepto
      price: firstRupee(body) ?? firstRupee(title),
      title: title.split(" - Buy")[0],
    };
  } catch (e) {
    throw new Error(`${e instanceof Error ? e.message : String(e)} || ${await pageState(page)}`);
  } finally {
    await ctx.close();
  }
}
