import type { MetaLineColumn } from "@/generated/prisma/client";
import { getTranslations } from "next-intl/server";
import { DataTable } from "@/components/ui";

export type MetaDocumentLineRow = Record<string, unknown> & { id?: string };

function cellValue(row: MetaDocumentLineRow, col: MetaLineColumn) {
  const key = col.systemField ?? col.code;
  const raw = row[key];
  if (raw == null) return "—";
  if (typeof raw === "object" && raw !== null) {
    if ("code" in raw && typeof raw.code === "string") return raw.code;
    if ("name" in raw && typeof raw.name === "string") return raw.name;
    if ("number" in raw && typeof raw.number === "string") return raw.number;
    if ("sku" in raw && "name" in raw) {
      return `${String((raw as { sku: string }).sku)} ${String((raw as { name: string }).name)}`;
    }
  }
  return String(raw);
}

export async function MetaDocumentLinesTable({
  columns,
  rows,
  title,
  empty,
  lineNoKey = "lineNo",
  actionsHeader,
  renderRowActions,
}: {
  columns: MetaLineColumn[];
  rows: MetaDocumentLineRow[];
  title?: string;
  empty?: string;
  lineNoKey?: string;
  actionsHeader?: string;
  renderRowActions?: (row: MetaDocumentLineRow) => React.ReactNode;
}) {
  const ts = await getTranslations("components.shared");
  const resolvedTitle = title ?? ts("lines");
  const resolvedEmpty = empty ?? ts("noRows");
  const visible = columns.filter((c) => c.listVisible);
  const headers = [
    ...visible.map((c) => c.name),
    ...(renderRowActions ? [actionsHeader ?? ""] : []),
  ];

  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)]">
      {resolvedTitle ? (
        <div className="border-b border-[var(--line)] px-4 py-2.5 text-sm font-medium">
          {resolvedTitle}
        </div>
      ) : null}
      <DataTable
        headers={headers}
        empty={rows.length === 0 ? resolvedEmpty : undefined}
      >
        {rows.map((row, index) => (
          <tr key={String(row.id ?? index)}>
            {visible.map((col) => {
              const value =
                col.code === lineNoKey
                  ? String(row[lineNoKey] ?? index + 1)
                  : cellValue(row, col);
              return (
                <td key={col.id} className="px-3 py-2">
                  {value}
                </td>
              );
            })}
            {renderRowActions ? (
              <td className="whitespace-nowrap px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {renderRowActions(row)}
                </div>
              </td>
            ) : null}
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
