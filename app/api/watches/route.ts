import { NextResponse } from "next/server";
import { addWatch, readWatches } from "@/lib/store";
import { PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readWatches());
}

export async function POST(req: Request) {
  const body = await req.json();

  const label = String(body.label ?? "").trim();
  const chatId =
    String(body.chatId ?? "").trim() || (process.env.DEFAULT_TELEGRAM_CHAT_ID ?? "").trim();
  const pincode = String(body.pincode ?? "").trim();
  const query = String(body.query ?? "").trim();
  const platforms: Platform[] = (
    Array.isArray(body.platforms) ? body.platforms : []
  ).filter((p: unknown): p is Platform => PLATFORMS.includes(p as Platform));

  const urls: Partial<Record<Platform, string>> = {};
  for (const p of PLATFORMS) {
    const u = String(body.urls?.[p] ?? "").trim();
    if (u) urls[p] = u;
  }

  if (!label || !chatId || !/^\d{6}$/.test(pincode) || !platforms.length) {
    return NextResponse.json(
      { error: "label, chatId, 6-digit pincode and at least one platform are required" },
      { status: 400 },
    );
  }
  // a selected platform with neither a URL nor a product name would just be skipped
  // forever, so refuse it up front instead of silently never checking it
  const unusable = platforms.filter((p) => !urls[p] && !query);
  if (unusable.length) {
    return NextResponse.json(
      {
        error: `give a product name, or a URL for: ${unusable
          .map((p) => PLATFORM_LABELS[p])
          .join(", ")}`,
      },
      { status: 400 },
    );
  }

  const watch = addWatch({ label, chatId, pincode, query: query || undefined, urls, platforms });
  return NextResponse.json(watch, { status: 201 });
}
