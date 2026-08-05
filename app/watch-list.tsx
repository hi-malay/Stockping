"use client";

import { useState } from "react";
import { PLATFORMS, PLATFORM_LABELS, type Platform, type Watch } from "@/lib/types";

const DEFAULT_PINCODE = "560100";

const emptyForm = {
  label: "",
  query: "",
  pincode: DEFAULT_PINCODE,
  chatId: "",
  urls: { blinkit: "", zepto: "", instamart: "" } as Record<Platform, string>,
  platforms: [...PLATFORMS] as Platform[],
};

const STATUS_STYLES: Record<string, string> = {
  in_stock: "bg-green-100 text-green-800",
  out_of_stock: "bg-red-100 text-red-700",
  error: "bg-yellow-100 text-yellow-800",
};

const inputCls = "mt-1 w-full rounded border px-2 py-1.5 text-sm";

export default function WatchList({
  initial,
  defaultChatId,
}: {
  initial: Watch[];
  defaultChatId: string;
}) {
  const [watches, setWatches] = useState(initial);
  const [form, setForm] = useState({ ...emptyForm, chatId: defaultChatId });
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/watches");
    setWatches(await res.json());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "could not add");
      return;
    }
    // keep chat id + pincode, they stay the same across a few adds
    setForm({ ...emptyForm, chatId: form.chatId || defaultChatId, pincode: form.pincode });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/watches/${id}`, { method: "DELETE" });
    load();
  }

  async function checkNow() {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/check", { method: "POST" });
      if (!res.ok) setError((await res.json()).error ?? "check failed");
    } finally {
      setChecking(false);
      load();
    }
  }

  function togglePlatform(p: Platform) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    }));
  }

  const rows = watches.flatMap((w) => w.platforms.map((p) => ({ w, p })));

  return (
    <>
      <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Label *">
            <input
              className={inputCls}
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Hot Wheels Batmobile"
            />
          </Field>
          <Field label="Pincode *">
            <input
              className={inputCls}
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              placeholder="560100"
            />
          </Field>
          <Field
            label="Telegram chat id *"
            hint="DM the bot /start, then get your id from @userinfobot"
          >
            <input
              className={inputCls}
              value={form.chatId}
              onChange={(e) => setForm({ ...form, chatId: e.target.value })}
              placeholder="123456789"
            />
          </Field>
        </div>

        <Field label="Product name" hint="used only for the platforms where you skip the URL">
          <input
            className={inputCls}
            value={form.query}
            onChange={(e) => setForm({ ...form, query: e.target.value })}
            placeholder="hot wheels batmobile"
          />
        </Field>

        {PLATFORMS.map((p) => (
          <Field key={p} label={`${PLATFORM_LABELS[p]} product URL`}>
            <input
              className={inputCls}
              value={form.urls[p]}
              onChange={(e) => setForm({ ...form, urls: { ...form.urls, [p]: e.target.value } })}
              placeholder={`paste the ${PLATFORM_LABELS[p]} product link (optional)`}
            />
          </Field>
        ))}

        <div className="flex flex-wrap items-center gap-4 pt-1">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.platforms.includes(p)}
                onChange={() => togglePlatform(p)}
              />
              {PLATFORM_LABELS[p]}
            </label>
          ))}
          <button
            type="submit"
            className="ml-auto rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Add watch
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Watching ({rows.length})</h2>
        <button
          onClick={checkNow}
          disabled={checking || !rows.length}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {checking ? "Checking…" : "Check now"}
        </button>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <Th>Product</Th>
              <Th>Platform</Th>
              <Th>Status</Th>
              <Th>Price</Th>
              <Th>Pincode</Th>
              <Th>Checked</Th>
              <Th>Link</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, p }) => {
              const r = w.results[p];
              return (
                <tr key={`${w.id}-${p}`} className="border-b">
                  <Td>
                    <span className="font-medium">{w.label}</span>
                    <div className="text-xs text-gray-400">chat {w.chatId}</div>
                  </Td>
                  <Td>{PLATFORM_LABELS[p]}</Td>
                  <Td>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        STATUS_STYLES[r?.status ?? ""] ?? "bg-gray-100 text-gray-500"
                      }`}
                      title={r?.error}
                    >
                      {r?.status ?? "not checked"}
                    </span>
                  </Td>
                  <Td>{r?.price ?? "—"}</Td>
                  <Td>{w.pincode}</Td>
                  <Td>
                    {r?.checkedAt
                      ? new Date(r.checkedAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Td>
                  <Td>
                    {r?.url ? (
                      <a href={r.url} target="_blank" className="text-blue-600 underline">
                        open
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <button onClick={() => remove(w.id)} className="text-xs text-red-600">
                      delete
                    </button>
                  </Td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-400">
                  nothing yet — add a watch above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="py-2 pr-3 font-medium">{children}</th>;
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td className="py-2 pr-3 align-top">{children}</td>;
}
