import { NextResponse } from "next/server";
import { addWatch, readWatches } from "@/lib/store";
import { platformFromUrl } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await readWatches());
}

export async function POST(req: Request) {
  const body = await req.json();

  const url = String(body.url ?? "").trim();
  const pincode = String(body.pincode ?? "").trim();
  const chatId =
    String(body.chatId ?? "").trim() || (process.env.DEFAULT_TELEGRAM_CHAT_ID ?? "").trim();

  const platform = platformFromUrl(url);
  if (!platform) {
    return NextResponse.json(
      { error: "paste a Blinkit, Zepto or Instamart product link" },
      { status: 400 },
    );
  }
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: "6-digit pincode required" }, { status: 400 });
  }
  if (!chatId) {
    return NextResponse.json({ error: "telegram chat id required" }, { status: 400 });
  }

  return NextResponse.json(await addWatch({ url, platform, pincode, chatId }), { status: 201 });
}
