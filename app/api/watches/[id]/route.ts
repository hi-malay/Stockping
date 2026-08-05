import { NextResponse } from "next/server";
import { deleteWatch } from "@/lib/store";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteWatch(id);
  return NextResponse.json({ ok: true });
}
