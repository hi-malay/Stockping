import type { Watch } from "./types";

// The store is stockping.json in the hi-malay/portfolio-data repo, same place the other
// little apps keep their data. One store for everyone: the Vercel UI writes to it, the
// Cloud Run cron reads it and writes results back.
const REPO = process.env.GITHUB_REPO ?? "hi-malay/portfolio-data";
const STORE_PATH = process.env.STORE_PATH ?? "stockping.json";
const BRANCH = process.env.STORE_BRANCH ?? "main";

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN missing — the store lives in GitHub, set it in .env.local");
  return t;
}

// A snapshot is what you read: the watches, plus what you need to write them back
// safely. Never write from a fresh read — read once, then write against that snapshot.
export type Snapshot = { watches: Watch[]; json: string; sha?: string };

const serialize = (w: Watch[]) => JSON.stringify(w, null, 2);

async function gh(method: string, route: string, body?: object) {
  return fetch(`https://api.github.com/repos/${REPO}/${route}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
}

export async function readSnapshot(): Promise<Snapshot> {
  // the cache buster matters: GitHub's CDN will happily serve a pre-write response for
  // a few seconds, and acting on that silently loses writes
  const res = await gh("GET", `contents/${STORE_PATH}?ref=${BRANCH}&_=${Date.now()}`);
  if (res.status === 404) return { watches: [], json: serialize([]) }; // file not created yet
  if (!res.ok) throw new Error(`github read failed ${res.status}: ${await res.text()}`);

  const { content, sha } = (await res.json()) as { content: string; sha: string };
  const text = Buffer.from(content, "base64").toString("utf8");
  const watches = text.trim() ? (JSON.parse(text) as Watch[]) : [];
  return { watches, json: serialize(watches), sha };
}

export async function readWatches(): Promise<Watch[]> {
  return (await readSnapshot()).watches;
}

export async function saveWatches(prev: Snapshot, next: Watch[], message: string) {
  const nextJson = serialize(next);
  // compared against the snapshot we were handed, never a fresh read
  if (prev.json === nextJson) return;

  const res = await gh("PUT", `contents/${STORE_PATH}`, {
    // [skip ci] so a data write never triggers a rebuild on Vercel or GitHub Actions
    message: `${message} [skip ci]`,
    content: Buffer.from(nextJson).toString("base64"),
    branch: BRANCH,
    ...(prev.sha ? { sha: prev.sha } : {}),
  });

  // 409/422 = someone committed between our read and write
  if (res.status === 409 || res.status === 422) {
    throw new Error(`github write conflict ${res.status} — retry the operation`);
  }
  if (!res.ok) throw new Error(`github write failed ${res.status}: ${await res.text()}`);
}

// read -> change -> write, retried once so a concurrent commit doesn't just fail
async function update(
  message: string,
  change: (watches: Watch[]) => Watch[],
  attempt = 0,
): Promise<void> {
  const prev = await readSnapshot();
  try {
    await saveWatches(prev, change(prev.watches), message);
  } catch (e) {
    if (attempt === 0 && String(e).includes("conflict")) return update(message, change, 1);
    throw e;
  }
}

export async function addWatch(w: Omit<Watch, "id" | "createdAt" | "result">): Promise<Watch> {
  const watch: Watch = { ...w, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await update(`add watch: ${w.platform}`, (all) => [...all, watch]);
  return watch;
}

export async function deleteWatch(id: string) {
  await update("delete watch", (all) => all.filter((w) => w.id !== id));
}
