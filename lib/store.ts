import fs from "node:fs";
import path from "node:path";
import type { Platform, StoredResult, Watch } from "./types";

// on Cloud Run this points at the mounted GCS bucket, locally it's ./data
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "watches.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readWatches(): Watch[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Watch[];
  } catch {
    return [];
  }
}

// tmp + rename so a crash mid-write can't leave a half-written file
export function writeWatches(watches: Watch[]) {
  ensureDir();
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(watches, null, 2));
  fs.renameSync(tmp, FILE);
}

export function addWatch(w: Omit<Watch, "id" | "createdAt" | "results">): Watch {
  const watch: Watch = {
    ...w,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    results: {},
  };
  const all = readWatches();
  all.push(watch);
  writeWatches(all);
  return watch;
}

export function deleteWatch(id: string) {
  writeWatches(readWatches().filter((w) => w.id !== id));
}

// re-reads before writing so the worker and the UI don't stomp each other
export function saveResult(id: string, platform: Platform, result: StoredResult) {
  const all = readWatches();
  const w = all.find((x) => x.id === id);
  if (!w) return;
  w.results[platform] = result;
  writeWatches(all);
}
