"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import {
  loadQuickPickList,
  type QuickCreated,
} from "@/lib/quick-create-actions";
import type { QuickCreateKind } from "@/components/quick-create-dialog";

type Option = { id: string; label: string };

export function ShowAllDialog({
  open,
  title,
  options,
  createKind,
  productId,
  counterpartyKind,
  selectedId,
  onClose,
  onSelect,
}: {
  open: boolean;
  title?: string;
  options: Option[];
  createKind?: QuickCreateKind | null;
  productId?: string;
  counterpartyKind?: "SUPPLIER" | "CUSTOMER" | "BOTH";
  selectedId?: string;
  onClose: () => void;
  onSelect: (item: QuickCreated) => void;
}) {
  const t = useTranslations("components.showAllDialog");
  const ts = useTranslations("components.shared");
  const resolvedTitle = title ?? t("defaultTitle");
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Option[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
    setRemote(null);

    if (!createKind) return;

    setLoading(true);
    void (async () => {
      try {
        const rows = await loadQuickPickList(createKind, {
          productId,
          counterpartyKind,
        });
        setRemote(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : ts("loadError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, createKind, productId, counterpartyKind]);

  const list = useMemo(() => {
    // Для партий не подмешиваем локальные опции сверх отфильтрованного списка
    const source =
      createKind === "lot" && productId
        ? (remote ?? options)
        : (() => {
            const map = new Map<string, Option>();
            for (const o of options) map.set(o.id, o);
            for (const o of remote ?? []) map.set(o.id, o);
            return [...map.values()];
          })();
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, remote, query, createKind, productId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-sm font-semibold">{resolvedTitle}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t("hint")}</p>
        </div>

        <div className="border-b border-[var(--line)] px-4 py-3">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            autoFocus
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-4 text-sm text-[var(--muted)]">{t("loading")}</p>
          ) : error ? (
            <p className="px-2 py-4 text-sm text-rose-700">{error}</p>
          ) : list.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--muted)]">{t("notFound")}</p>
          ) : (
            <ul className="space-y-0.5">
              {list.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={
                        active
                          ? "w-full rounded-md bg-[var(--accent)]/10 px-3 py-2 text-left text-sm font-medium text-[var(--accent)]"
                          : "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface)]"
                      }
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--line)] px-4 py-3">
          <button
            type="button"
            className={buttonSecondaryClass}
            onClick={onClose}
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
