"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";

import { tsdFetch } from "@/lib/tsd/client-api";

const DEVICE_KEY = "wms.tsd.deviceKey";

async function api(path: string, init?: RequestInit) {
  return tsdFetch(path, init);
}

type Plan = {
  locationId: string;
  locationCode: string;
  locationName: string;
  ruleCode: string;
  reason: string;
};

type Task = {
  id: string;
  code: string;
  location: { code: string; name: string } | null;
  lines: Array<{ sku: string; name: string; quantity: number }>;
};

export function TsdPutawayWizard({
  allowFreePutaway = false,
}: {
  allowFreePutaway?: boolean;
}) {
  const t = useTranslations("components.tsdPutaway");
  const ts = useTranslations("components.shared");
  const [tnCode, setTnCode] = useState("");
  const [overrideCell, setOverrideCell] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pallet, setPallet] = useState<{ id: string; code: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [content, setContent] = useState<
    Array<{ product: { sku: string; name: string }; quantity: number }>
  >([]);
  const [allowOverride, setAllowOverride] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function loadTasks() {
    try {
      const data = await api("/api/tsd/putaway/tasks");
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  async function planPutaway(code?: string, entry: "task" | "scan" = "task") {
    const scan = (code ?? tnCode).trim();
    if (!scan) {
      setError(t("specifyTn"));
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      let deviceKey = localStorage.getItem(DEVICE_KEY);
      if (!deviceKey) {
        deviceKey = crypto.randomUUID();
        localStorage.setItem(DEVICE_KEY, deviceKey);
      }
      const sess = await api("/api/tsd/session", {
        method: "POST",
        body: JSON.stringify({ type: "putaway", deviceKey }),
      });
      setSessionId(sess.session.id);

      const data = await api("/api/tsd/putaway/plan", {
        method: "POST",
        body: JSON.stringify({ palletCode: scan, entry }),
      });
      setTnCode(data.pallet?.code ?? scan);
      setPallet(data.pallet);
      setPlan(data.plan);
      setContent(data.content || []);
      setAllowOverride(data.allowOverride !== false);
      if (!data.plan) {
        setError(t("locationNotFound"));
      } else {
        setMessage(data.plan.locationCode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : ts("genericError"));
      setPallet(null);
      setPlan(null);
    } finally {
      setPending(false);
    }
  }

  async function confirm(useOverride: boolean) {
    if (!pallet) return;
    setPending(true);
    setError(null);
    try {
      const data = await api("/api/tsd/putaway/confirm", {
        method: "POST",
        body: JSON.stringify({
          palletId: pallet.id,
          sessionId,
          locationCode: useOverride ? overrideCell.trim() : undefined,
        }),
      });
      setMessage(t("placed", { code: data.location?.code ?? "—" }));
      setPlan(null);
      setContent([]);
      setOverrideCell("");
      setPallet(null);
      setTnCode("");
      void loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : ts("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {!pallet ? (
        <>
          <Panel title={t("toPutaway")}>
            {tasks.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("noPallets")}</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="flex w-full flex-col rounded-lg border border-[var(--line)] px-3 py-3 text-left hover:border-[var(--accent)]"
                    disabled={pending}
                    onClick={() => void planPutaway(task.code, "task")}
                  >
                    <span className="text-sm font-semibold">{task.code}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {task.location?.code ?? "—"} · {ts("lineCount", { count: task.lines.length })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          {allowFreePutaway ? (
            <Panel title={t("scanTn")}>
              <div className="space-y-3">
                <Field label={ts("codeRequired")}>
                  <input
                    className={`${inputClass} text-lg`}
                    value={tnCode}
                    onChange={(e) => setTnCode(e.target.value)}
                    autoFocus
                  />
                </Field>
                <button
                  className={`${buttonClass} w-full py-3`}
                  type="button"
                  disabled={pending || !tnCode.trim()}
                  onClick={() => void planPutaway(undefined, "scan")}
                >
                  {ts("next")}
                </button>
              </div>
            </Panel>
          ) : null}
        </>
      ) : (
        <Panel title={pallet.code}>
          <ul className="mb-3 space-y-1 text-sm">
            {content.map((c, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {c.product.sku} {c.product.name}
                </span>
                <span className="text-xs">{c.quantity}</span>
              </li>
            ))}
          </ul>
          {plan ? (
            <p className="mb-3 rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-semibold">
              {plan.locationCode}
            </p>
          ) : null}
          <button
            className={`${buttonClass} w-full py-3`}
            type="button"
            disabled={pending || !plan}
            onClick={() => void confirm(false)}
          >
            {ts("place")}
          </button>

          {allowOverride ? (
            <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
              <Field label={ts("location")}>
                <input
                  className={`${inputClass} text-lg`}
                  value={overrideCell}
                  onChange={(e) => setOverrideCell(e.target.value)}
                />
              </Field>
              <button
                className={`${buttonSecondaryClass} w-full`}
                type="button"
                disabled={pending || !overrideCell.trim()}
                onClick={() => void confirm(true)}
              >
                {ts("place")}
              </button>
            </div>
          ) : null}
          <button
            className={`${buttonSecondaryClass} mt-3 w-full`}
            type="button"
            onClick={() => {
              setPallet(null);
              setPlan(null);
              setContent([]);
            }}
          >
            {ts("back")}
          </button>
        </Panel>
      )}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
