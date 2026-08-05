// Reads whoever has DM'd the bot and writes the first chat id into .env.local
// as DEFAULT_TELEGRAM_CHAT_ID. Saves the @userinfobot round trip.
//   npm run chatid
import fs from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Update = { message?: { chat: { id: number; first_name?: string; username?: string } } };

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN missing in .env.local");
    process.exit(1);
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const json = (await res.json()) as { ok: boolean; result?: Update[]; description?: string };

  if (!json.ok) {
    console.error("telegram error:", json.description);
    process.exit(1);
  }

  const chats = new Map<number, string>();
  for (const u of json.result ?? []) {
    const c = u.message?.chat;
    if (c) chats.set(c.id, c.username ?? c.first_name ?? "");
  }

  if (!chats.size) {
    console.log("No chats yet. Open the bot in Telegram, send /start, then run this again.");
    return;
  }

  for (const [id, name] of chats) console.log(`${id}  ${name}`);

  const [first] = [...chats.keys()];
  const env = fs.readFileSync(".env.local", "utf8");
  fs.writeFileSync(
    ".env.local",
    env.includes("DEFAULT_TELEGRAM_CHAT_ID=")
      ? env.replace(/DEFAULT_TELEGRAM_CHAT_ID=.*/, `DEFAULT_TELEGRAM_CHAT_ID=${first}`)
      : `${env.trimEnd()}\nDEFAULT_TELEGRAM_CHAT_ID=${first}\n`,
  );
  console.log(`\nwrote DEFAULT_TELEGRAM_CHAT_ID=${first} to .env.local`);
}

main();
