import { NextResponse } from "next/server";
import { runAllChecks } from "@/lib/checker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const summary = await runAllChecks();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
