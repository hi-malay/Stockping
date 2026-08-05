# stockping

Watches products on **Blinkit, Zepto and Instamart** at a given pincode, checks every 30 minutes,
and pings you on **Telegram** the moment something is back in stock — with the price and a direct
product link.

Multiple people can use one instance. Each watch belongs to a Telegram chat id, and one person can
add as many products as they want.

Everything it uses is free: Telegram Bot API, Playwright, and your own machine. No paid API anywhere.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env.local
```

Then make the bot:

1. Telegram → **@BotFather** → `/newbot` → copy the token into `.env.local` as `TELEGRAM_BOT_TOKEN`.
2. DM your new bot `/start` (a bot can't message you until you've talked to it first).
3. Telegram → **@userinfobot** → it replies with your numeric chat id. That's what goes in the UI.

## Running

Two terminals:

```bash
npm run dev      # UI on http://localhost:3000
npm run worker   # cron, checks every 30 min
```

The worker also runs one check immediately on boot so you don't have to wait.

## Adding a watch

Fill the form: label, pincode (defaults to `560100`), your chat id, and then either

- a **product URL** per platform — most accurate, or
- a **product name** — searched on each platform, first result is used.

Per platform it uses the URL if you gave one, otherwise the name. A platform you tick with neither
a URL nor a name gets rejected, because it could never be checked.

**Check now** runs everything immediately instead of waiting for the cron.

## How it decides "in stock"

All three sites are location-driven, and none of them take a pincode from a URL — the pincode has
to be typed into the site's own location box, exactly like a human does. This matters a lot: the
Instamart Batmobile reads `ADD ₹179` with no location set and `SOLD OUT ₹167` once 560100 is
applied. Skip the location step and you get fake stock.

So each scraper: opens its own persistent browser profile → sets the pincode through the site's UI
if it isn't already set → opens the product page → reads stock and price.

- **Blinkit** — location bar → `select-locality` input → first suggestion. Stock and price come from
  the page's `ld+json` Product `offers`, cross-checked against the "Add to cart" button.
- **Zepto** — "Select Location" → "Search a new address" → first suggestion. No `ld+json`, so the
  "Add to Cart" button is the stock signal and the first ₹ on the page is the price.
- **Instamart** — the `/item/<id>` page has no location UI, so the pincode is set on the home page
  first. Extra wrinkle: after picking the suggestion it shows a map and you must hit
  **Confirm Location**. Stock and price from `ld+json` + `[data-testid="sold-out"]`.

The location survives between runs via the persistent profiles in `data/profiles/<platform>/`, so
only the first run pays the cost of the location dance. Instamart's location cookie is httpOnly, so
that profile is the only way to keep it — don't delete the folder unless you want it redone.

## Telegram message

```
🟢 IN STOCK — Hot Wheels Classic TV Series Batmobile Die Cast Car
Blinkit · ₹167 · 560100
https://blinkit.com/prn/hot-wheels-classic-tv-series-batmobile-die-cast-car/prid/771901
```

One message per platform, so you know where to actually go and buy it.

It only pings on the **flip** into stock — not every 30 minutes while it stays available. If a send
fails, `notifiedAt` stays unset so the next run retries. Scrape errors are stored as `error` and
logged, never sent to Telegram, so a site hiccup doesn't spam everyone.

## Debugging a broken scraper

These sites change their markup often. When one breaks, run the probe against it directly:

```bash
npm run probe blinkit "https://blinkit.com/prn/.../prid/771901"
npm run probe zepto "hot wheels batmobile"
HEADED=1 npm run probe instamart "https://instamart.in/item/OG4GFD3UJD"
```

`HEADED=1` opens a real window so you can watch where it gets stuck. Each platform lives in its own
file under `lib/scrapers/`, so a break is a one-file fix.

Canary to remember: if Instamart ever reports in stock at ₹179, the location step silently failed.

## Notes

- `data/` holds everything — `watches.json` (the whole DB) and the browser profiles. It's gitignored.
- Override the schedule for testing: `CRON="*/2 * * * *" npm run worker`.
- All three sites sit behind AWS WAF. The persistent profile plus a real user agent keeps them
  happy; 30 minutes is a gentle enough interval. Don't crank it down to every minute.
- This can't run on Vercel's free tier — Playwright needs a real machine, so it runs locally.
# Stockping
