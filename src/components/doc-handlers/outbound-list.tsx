import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  DataTable,
  Field,
  Page,
  PageHeader,
  Panel,
  StatusBadge,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  OUTBOUND_KINDS,
  outboundKindLabel,
  parseOutboundKindList,
  formatOutboundKindFilterLabel,
} from "@/lib/outbound-document";
import { parseStatusList, formatStatusFilterLabel } from "@/lib/list-filters";
import {
  formatListCellValue,
  getDocumentListColumns,
  loadBatchDocumentExtraValues,
} from "@/lib/meta/document-form";
import { docDetailPath, docListPath, docNewPath } from "@/lib/meta/document-paths";
import { listStatuses } from "@/lib/status";
import { requireModule } from "@/lib/session";

export async function OutboundListView({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string; q?: string }>;
}) {
  await requireModule("outbound");
  const t = await getTranslations("components.docHandlers.outbound");
  const ts = await getTranslations("components.shared");
  const { status: statusRaw, kind: kindRaw, q: qRaw } = await searchParams;
  const statuses = parseStatusList(statusRaw);
  const kinds = parseOutboundKindList(kindRaw);
  const q = qRaw?.trim() ?? "";

  const where: Prisma.OutboundDocumentWhereInput = {};
  if (statuses) where.status = { in: statuses };
  if (kinds) where.kind = { in: kinds };
  if (q) {
    where.OR = [
      { number: { contains: q } },
      { customer: { contains: q } },
      { salesOrderRef: { contains: q } },
      { waybillRef: { contains: q } },
      { externalRef: { contains: q } },
      { notes: { contains: q } },
    ];
  }

  const [docs, statusCatalog, listColumns] = await Promise.all([
    prisma.outboundDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        receivingDock: { include: { zone: true } },
        transportUnit: true,
        _count: { select: { lines: true } },
      },
    }),
    listStatuses("outbound"),
    getDocumentListColumns("outbound"),
  ]);

  const extraByDoc = await loadBatchDocumentExtraValues(
    "outbound",
    docs.map((d) => d.id),
  );

  const filterParts: string[] = [];
  if (statuses) filterParts.push(formatStatusFilterLabel(statuses));
  if (kinds) filterParts.push(formatOutboundKindFilterLabel(kinds));
  if (q) filterParts.push(ts("searchFilter", { q }));
  const hasFilters = Boolean(statuses || kinds || q);

  return (
    <Page>
      <PageHeader
        title={t("listTitle")}
        description={
          filterParts.length > 0
            ? ts("filterPrefix", { parts: filterParts.join(" · ") })
            : t("listDescription")
        }
        actions={
          <>
            {hasFilters ? (
              <Link href={docListPath("outbound")} className={buttonSecondaryClass}>
                {ts("reset")}
              </Link>
            ) : null}
            <Link href={docNewPath("outbound")} className={buttonClass}>
              {ts("create")}
            </Link>
          </>
        }
      />

      <Panel title={ts("searchFilters")}>
        <form
          method="get"
          className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem_auto]"
        >
          <Field label={ts("search")} className="min-w-0">
            <input
              className={inputClass}
              name="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
            />
          </Field>
          <Field label={ts("type")} className="min-w-0">
            <select className={inputClass} name="kind" defaultValue={kindRaw ?? ""}>
              <option value="">{ts("allTypes")}</option>
              {OUTBOUND_KINDS.map((code) => (
                <option key={code} value={code}>
                  {outboundKindLabel(code)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={ts("status")} className="min-w-0">
            <select className={inputClass} name="status" defaultValue={statusRaw ?? ""}>
              <option value="">{ts("allStatuses")}</option>
              {statusCatalog.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="submit" className={buttonClass}>
              {ts("find")}
            </button>
          </div>
        </form>
      </Panel>

      <Panel flush>
        <DataTable
          headers={[...listColumns.map((c) => c.name), ts("status"), ts("lines")]}
          empty={
            docs.length === 0
              ? hasFilters
                ? ts("noRowsFiltered")
                : ts("noDocuments")
              : undefined
          }
        >
          {docs.map((d) => {
            const href = docDetailPath("outbound", d.id);
            const docRow = d as Record<string, unknown>;
            const extras = extraByDoc[d.id] ?? {};
            return (
              <tr key={d.id} className="relative hover:bg-[var(--surface)]/60">
                {listColumns.map((col) => {
                  const value = formatListCellValue("outbound", col, docRow, extras);
                  const isNumber = col.code === "number";
                  return (
                    <td key={col.id} className="px-3 py-2">
                      {isNumber ? (
                        <Link
                          href={href}
                          aria-label={ts("openDocument", { number: d.number })}
                          className="after:absolute after:inset-0 after:content-['']"
                        >
                          <span className="relative z-10 font-medium">{value}</span>
                        </Link>
                      ) : (
                        <span
                          className={
                            col.type === "date" ? "text-[var(--muted)]" : undefined
                          }
                        >
                          {value}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="relative z-10 px-3 py-2">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-3 py-2">{d._count.lines}</td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
