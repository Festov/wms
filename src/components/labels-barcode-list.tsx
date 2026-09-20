"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DataTable,
  Field,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { code128Svg } from "@/lib/labels";
import { cn } from "@/lib/format";
import type { BarcodeCatalogEntry } from "@/lib/barcode-catalog";

type PrintFormat = "code128" | "qr";

type PrintLabel = BarcodeCatalogEntry & {
  imageSrc?: string;
  barcodeSvg?: string;
};

export function LabelsBarcodeList({ entries }: { entries: BarcodeCatalogEntry[] }) {
  const t = useTranslations("components.labelsBarcodeList");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<PrintFormat>("code128");
  const [printLabels, setPrintLabels] = useState<PrintLabel[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.code.toLowerCase().includes(q) ||
        entry.title.toLowerCase().includes(q) ||
        entry.kindLabel.toLowerCase().includes(q),
    );
  }, [entries, query]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePrint() {
    const items = entries.filter((entry) => selected.has(entry.id));
    if (items.length === 0) return;

    let rendered: PrintLabel[];
    if (format === "qr") {
      const { default: QRCode } = await import("qrcode");
      rendered = await Promise.all(
        items.map(async (entry) => ({
          ...entry,
          imageSrc: await QRCode.toDataURL(entry.code, {
            margin: 1,
            width: 180,
            errorCorrectionLevel: "M",
          }),
        })),
      );
    } else {
      rendered = items.map((entry) => ({
        ...entry,
        barcodeSvg: code128Svg(entry.code),
      }));
    }

    setPrintLabels(rendered);
    requestAnimationFrame(() => {
      window.print();
      window.setTimeout(() => setPrintLabels([]), 300);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-6 print:hidden">
        <Panel>
          <p className="text-sm text-[var(--muted)]">{t("hint")}</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
            <Field label={t("search")} className="min-w-[16rem] flex-1">
              <input
                className={inputClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </Field>
            <Field label={t("labelType")} className="min-w-[10rem]">
              <select
                className={inputClass}
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as PrintFormat)
                }
              >
                <option value="code128">Code128</option>
                <option value="qr">QR</option>
              </select>
            </Field>
            <button
              type="button"
              className={buttonClass}
              disabled={selected.size === 0}
              onClick={() => void handlePrint()}
            >
              {selected.size > 0
                ? t("printCount", { count: selected.size })
                : t("print")}
            </button>
          </div>
        </Panel>

        <Panel flush title={t("title", { count: filtered.length })}>
          <DataTable
            headers={["", t("colType"), t("colObject"), t("colBarcode"), ""]}
            empty={
              filtered.length === 0
                ? query
                  ? t("emptyFiltered")
                  : t("emptyDefault")
                : undefined
            }
          >
            {filtered.map((entry) => {
              const isSelected = selected.has(entry.id);
              return (
                <tr
                  key={entry.id}
                  className={cn(
                    "cursor-pointer hover:bg-[var(--surface)]/60",
                    isSelected && "bg-[var(--surface)]/80",
                  )}
                  onClick={() => toggleOne(entry.id)}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(entry.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t("selectAria", { code: entry.code })}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {entry.kindLabel}
                  </td>
                  <td className="px-3 py-2.5">{entry.title}</td>
                  <td className="px-3 py-2.5 font-mono text-sm">{entry.code}</td>
                  <td className="px-3 py-2.5 text-right">
                    {entry.catalogHref ? (
                      <Link
                        href={entry.catalogHref}
                        className={buttonSecondaryClass}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {t("card")}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>
      </div>

      <div className="print-label-sheet hidden print:grid print:grid-cols-2 print:gap-6 print:p-6">
        {printLabels.map((label) => (
          <div
            key={label.id}
            className="break-inside-avoid rounded border border-[var(--line)] p-4 text-center"
          >
            <p className="mb-3 text-sm font-medium">{label.title}</p>
            {label.imageSrc ? (
              // Dynamic barcode data URLs are not compatible with next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={label.imageSrc}
                alt=""
                width={160}
                height={160}
                className="mx-auto"
              />
            ) : null}
            {label.barcodeSvg ? (
              <div
                className="mx-auto w-full overflow-hidden"
                dangerouslySetInnerHTML={{ __html: label.barcodeSvg }}
              />
            ) : null}
            <p className="mt-3 font-mono text-sm">{label.code}</p>
          </div>
        ))}
      </div>
    </>
  );
}
