"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

const QUEUE_KEY = "wms.tsd.offlineQueue";

type Mode = "receive" | "pick" | "transfer";

type QueueItem = {
  id: string;
  mode: Mode;
  body: Record<string, unknown>;
  createdAt: string;
};

function readQueue(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

import { readTsdApiKey } from "@/lib/tsd/client-storage";

export function TsdScanForm({
  mode,
  lotsEnabled = false,
}: {
  mode: Mode;
  lotsEnabled?: boolean;
}) {
  const t = useTranslations("components.tsdScan");
  const ts = useTranslations("components.shared");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueLen, setQueueLen] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setQueueLen(readQueue().length);
  }, []);

  async function getApiKey() {
    const key = readTsdApiKey();
    if (!key) throw new Error(t("apiKeyMissing"));
    return key;
  }

  async function send(body: Record<string, unknown>) {
    const path =
      mode === "receive"
        ? "/api/tsd/receive"
        : mode === "pick"
          ? "/api/tsd/pick"
          : "/api/tsd/transfer";
    const apiKey = await getApiKey();
    const res = await fetch(path, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "cache-control": "no-store",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        data.error || t("httpError", { status: res.status }),
      );
    }
    return data;
  }

  async function flushQueue() {
    const queue = readQueue();
    const remain: QueueItem[] = [];
    for (const item of queue) {
      try {
        await send(item.body);
      } catch {
        remain.push(item);
      }
    }
    writeQueue(remain);
    setQueueLen(remain.length);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      productBarcode: String(fd.get("productBarcode") ?? "").trim(),
      quantity: Number(fd.get("quantity") ?? 1),
    };
    if (lotsEnabled) {
      body.lotNumber = String(fd.get("lotNumber") ?? "").trim() || undefined;
    }
    if (mode === "transfer") {
      body.fromLocationCode = String(fd.get("fromLocationCode") ?? "").trim();
      body.toLocationCode = String(fd.get("toLocationCode") ?? "").trim();
    } else {
      body.locationCode = String(fd.get("locationCode") ?? "").trim();
    }

    try {
      if (!navigator.onLine) throw new Error(t("offline"));
      await send(body);
      setMessage(t("success"));
      e.currentTarget.reset();
      await flushQueue();
    } catch (err) {
      const item: QueueItem = {
        id: crypto.randomUUID(),
        mode,
        body,
        createdAt: new Date().toISOString(),
      };
      const q = readQueue();
      q.push(item);
      writeQueue(q);
      setQueueLen(q.length);
      setError(
        err instanceof Error && err.message !== t("offline")
          ? t("errorQueued", { count: q.length })
          : t("offlineQueued", { count: q.length }),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Panel title={t("title")}>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label={t("product")}>
            <input
              className={`${inputClass} text-lg`}
              name="productBarcode"
              required
              autoFocus
            />
          </Field>
          {mode === "transfer" ? (
            <>
              <Field label={t("from")}>
                <input
                  className={`${inputClass} text-lg`}
                  name="fromLocationCode"
                  required
                />
              </Field>
              <Field label={t("to")}>
                <input
                  className={`${inputClass} text-lg`}
                  name="toLocationCode"
                  required
                />
              </Field>
            </>
          ) : (
            <Field label={t("location")}>
              <input
                className={`${inputClass} text-lg`}
                name="locationCode"
                required
              />
            </Field>
          )}
          <Field label={t("quantity")}>
            <input
              className={`${inputClass} text-lg`}
              name="quantity"
              type="number"
              step="any"
              defaultValue={1}
              required
            />
          </Field>
          {lotsEnabled ? (
            <Field label={t("lot")}>
              <input className={`${inputClass} text-lg`} name="lotNumber" />
            </Field>
          ) : null}
          <button className={`${buttonClass} w-full py-3 text-base`} disabled={pending}>
            {pending ? t("submitting") : ts("confirm")}
          </button>
        </form>
      </Panel>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>{t("queue", { count: queueLen })}</span>
        <button type="button" className="text-[var(--accent)]" onClick={() => flushQueue()}>
          {t("flushQueue")}
        </button>
      </div>
    </div>
  );
}
