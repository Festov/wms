"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { DataTable, buttonSecondaryClass } from "@/components/ui";

export type InboundFactLineView = {
  id: string;
  index: number;
  productSku: string;
  productName: string;
  packageLabel: string;
  lotLabel: string;
  palletCode: string;
  locationCode: string;
  quantity: number;
};

export function InboundReceiveFactButton({
  lines,
  plannedQty,
  receivedQty,
  palletCount,
  postedAtLabel,
  lotsEnabled,
}: {
  lines: InboundFactLineView[];
  plannedQty: number;
  receivedQty: number;
  palletCount: number;
  postedAtLabel: string | null;
  lotsEnabled: boolean;
}) {
  const t = useTranslations("components.inboundReceiveFact");
  const ts = useTranslations("components.shared");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (lines.length === 0 && receivedQty <= 0) return null;

  const summary =
    t("summary", {
      lineCount: lines.length,
      received: receivedQty,
      planned: plannedQty || "—",
      pallets: palletCount,
    }) +
    (postedAtLabel ? t("postedSuffix", { date: postedAtLabel }) : "");

  const dialog = open ? (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inbound-fact-title"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-5xl rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            <h2 id="inbound-fact-title" className="text-lg font-semibold">
              {t("title")}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{summary}</p>
          </div>
          <button
            type="button"
            className={buttonSecondaryClass}
            onClick={() => setOpen(false)}
          >
            {t("close")}
          </button>
        </div>
        <DataTable
          headers={
            lotsEnabled
              ? [
                  ts("rowNo"),
                  ts("product"),
                  ts("package"),
                  ts("lot"),
                  ts("pallet"),
                  ts("location"),
                  ts("quantityShort"),
                ]
              : [
                  ts("rowNo"),
                  ts("product"),
                  ts("package"),
                  ts("pallet"),
                  ts("location"),
                  ts("quantityShort"),
                ]
          }
          empty={t("empty")}
        >
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2">{line.index}</td>
              <td className="px-3 py-2">
                {line.productSku} {line.productName}
              </td>
              <td className="px-3 py-2">{line.packageLabel}</td>
              {lotsEnabled ? (
                <td className="px-3 py-2">{line.lotLabel}</td>
              ) : null}
              <td className="px-3 py-2">{line.palletCode}</td>
              <td className="px-3 py-2">{line.locationCode}</td>
              <td className="px-3 py-2">{line.quantity}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={buttonSecondaryClass}
        onClick={() => setOpen(true)}
      >
        {lines.length > 0
          ? t("factLinesCount", { count: lines.length })
          : t("factLines")}
      </button>
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
