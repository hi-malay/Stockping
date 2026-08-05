import fs from "node:fs";
import path from "node:path";
import type { StoredResult, Watch } from "./types";

// on Cloud Run this points at the mounted GCS bucket, locally it's ./data
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "watches.json");

export function readWatches(): Watch[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Watch[];
  } catch {
    return [];
  }
}

// tmp + rename so a crash mid-write can't leave a half-written file
export function writeWatches(watches: Watch[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(watches, null, 2));
  fs.renameSync(tmp, FILE);
}

export function addWatch(w: Omit<Watch, "id" | "createdAt" | "result">): Watch {
  const watch: Watch = { ...w, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  writeWatches([...readWatches(), watch]);
  return watch;
}

export function deleteWatch(id: string) {
  writeWatches(readWatches().filter((w) => w.id !== id));
}

// re-reads before writing so the worker and the UI don't stomp each other
export function saveResult(id: string, result: StoredResult) {
  const all = readWatches();
  const w = all.find((x) => x.id === id);
  if (!w) return;
  w.result = result;
  writeWatches(all);
}
