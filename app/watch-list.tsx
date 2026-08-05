"use client";

import { useState } from "react";
import { PLATFORM_LABELS, type Watch } from "@/lib/types";

const DEFAULT_PINCODE = "560100";

const STATUS_STYLES: Record<string, string> = {
  in_stock: "bg-green-100 text-green-800",
  out_of_stock: "bg-red-100 text-red-700",
  error: "bg-yellow-100 text-yellow-800",
};

const inputCls = "mt-1 w-full rounded border px-2 py-1.5 text-sm";

export default function WatchList({
  initial,
  defaultChatId,
  canCheckNow,
}: {
  initial: Watch[];
  defaultChatId: string;
  canCheckNow: boolean;
}) {
  const [watches, setWatches] = useState(initial);
  const [url, setUrl] = useState("");
  const [pincode, setPincode] = useState(DEFAULT_PINCODE);
  const [chatId, setChatId] = useState(defaultChatId);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setWatches(await (await fetch("/api/watches")).json());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, pincode, chatId }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "could not add");
      return;
    }
    setUrl(""); // pincode and chat id stay, they repeat across adds
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

  return (
    <>
      <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border p-4">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Product URL</span>
          <input
            className={inputCls}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="paste a Blinkit, Zepto or Instamart product link"
          />
          <span className="mt-0.5 block text-xs text-gray-400">
            the platform is picked up from the link
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Pincode</span>
            <input
              className={inputCls}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="560100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Telegram chat id</span>
            <input
              className={inputCls}
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="123456789"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Add watch
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Watching ({watches.length})</h2>
        {canCheckNow ? (
          <button
            onClick={checkNow}
            disabled={checking || !watches.length}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {checking ? "Checking…" : "Check now"}
          </button>
        ) : (
          <span className="text-xs text-gray-400">checked every 30 min by the cron</span>
        )}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <Th>Product</Th>
              <Th>Platform</Th>
              <Th>Status</Th>
              <Th>Price</Th>
              <Th>Pincode</Th>
              <Th>Checked</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {watches.map((w) => (
              <tr key={w.id} className="border-b">
                <Td>
                  <a href={w.url} target="_blank" className="font-medium text-blue-600 underline">
                    {w.result?.title ?? w.url}
                  </a>
                  <div className="text-xs text-gray-400">chat {w.chatId}</div>
                </Td>
                <Td>{PLATFORM_LABELS[w.platform]}</Td>
                <Td>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      STATUS_STYLES[w.result?.status ?? ""] ?? "bg-gray-100 text-gray-500"
                    }`}
                    title={w.result?.error}
                  >
                    {w.result?.status ?? "not checked"}
                  </span>
                </Td>
                <Td>{w.result?.price ?? "—"}</Td>
                <Td>{w.pincode}</Td>
                <Td>
                  {w.result?.checkedAt
                    ? new Date(w.result.checkedAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </Td>
                <Td>
                  <button onClick={() => remove(w.id)} className="text-xs text-red-600">
                    delete
                  </button>
                </Td>
              </tr>
            ))}
            {!watches.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-400">
                  nothing yet — paste a product link above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="py-2 pr-3 font-medium">{children}</th>;
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td className="py-2 pr-3 align-top">{children}</td>;
}
