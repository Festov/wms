"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";
import {
  TSD_API_KEY_STORAGE,
  TSD_DEVICE_KEY_STORAGE,
  TSD_DEVICE_NAME_STORAGE,
} from "@/lib/tsd/client-storage";

export function TsdDeviceForm() {
  const t = useTranslations("components.tsdDevice");
  const [deviceKey, setDeviceKey] = useState("");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let key = localStorage.getItem(TSD_DEVICE_KEY_STORAGE);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(TSD_DEVICE_KEY_STORAGE, key);
    }
    setDeviceKey(key);
    setName(localStorage.getItem(TSD_DEVICE_NAME_STORAGE) || t("defaultName"));
    setApiKey(localStorage.getItem(TSD_API_KEY_STORAGE) || "");
    setMounted(true);
  }, [t]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!apiKey.trim()) {
      setStatus(t("apiKeyRequired"));
      return;
    }
    localStorage.setItem(TSD_DEVICE_NAME_STORAGE, name);
    localStorage.setItem(TSD_API_KEY_STORAGE, apiKey.trim());
    const res = await fetch("/api/tsd/device", {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey.trim(),
        "cache-control": "no-store",
      },
      body: JSON.stringify({ deviceKey, name }),
    });
    if (!res.ok) {
      setStatus(t("registerError"));
      return;
    }
    setStatus(t("registered"));
  }

  if (!mounted) {
    return (
      <Panel title={t("title")}>
        <p className="text-sm text-[var(--muted)]">{t("loading")}</p>
      </Panel>
    );
  }

  return (
    <Panel title={t("title")}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label={t("deviceKey")}>
          <input className={inputClass} value={deviceKey} readOnly />
        </Field>
        <Field label={t("name")}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("apiKey")}>
          <input
            className={inputClass}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("apiKeyPlaceholder")}
            required
          />
        </Field>
        {!apiKey.trim() ? (
          <p className="text-sm text-amber-700">{t("apiKeyMissing")}</p>
        ) : null}
        <button className={buttonClass} type="submit">
          {t("saveRegister")}
        </button>
        {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
      </form>
    </Panel>
  );
}
