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
  INBOUND_KINDS,
  inboundKindLabel,
  parseInboundKindList,
  formatInboundKindFilterLabel,
} from "@/lib/inbound-document";
import { parseStatusList, formatStatusFilterLabel } from "@/lib/list-filters";
import {
  formatListCellValue,
  getDocumentListColumns,
  loadBatchDocumentExtraValues,
} from "@/lib/meta/document-form";
import { docDetailPath, docListPath, docNewPath } from "@/lib/meta/document-paths";
import { listStatuses } from "@/lib/status";
import { requireModule } from "@/lib/session";

export async function InboundListView({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string; q?: string }>;
}) {
  await requireModule("inbound");
  const t = await getTranslations("components.docHandlers.inbound");
  const ts = await getTranslations("components.shared");
  const { migrateInboundCompletedToPlaced } = await import("@/lib/inbound-place");
  await migrateInboundCompletedToPlaced();
  const { status: statusRaw, kind: kindRaw, q: qRaw } = await searchParams;
  const statuses = parseStatusList(statusRaw);
  const kinds = parseInboundKindList(kindRaw);
  const q = qRaw?.trim() ?? "";

  const where: Prisma.InboundDocumentWhereInput = {};
  if (statuses) where.status = { in: statuses };
  if (kinds) where.kind = { in: kinds };
  if (q) {
    where.OR = [
      { number: { contains: q } },
      { supplier: { contains: q } },
      { purchaseOrderRef: { contains: q } },
      { waybillRef: { contains: q } },
      { externalRef: { contains: q } },
      { notes: { contains: q } },
    ];
  }

  const [docs, statusCatalog, listColumns] = await Promise.all([
    prisma.inboundDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        receivingDock: { include: { zone: true } },
        transportUnit: true,
        _count: { select: { lines: { where: { locationId: null } } } },
      },
    }),
    listStatuses("inbound"),
    getDocumentListColumns("inbound"),
  ]);

  const extraByDoc = await loadBatchDocumentExtraValues(
    "inbound",
    docs.map((d) => d.id),
  );

  const filterParts: string[] = [];
  if (statuses) filterParts.push(formatStatusFilterLabel(statuses));
  if (kinds) filterParts.push(formatInboundKindFilterLabel(kinds));
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
              <Link href={docListPath("inbound")} className={buttonSecondaryClass}>
                {ts("reset")}
              </Link>
            ) : null}
            <Link href="/catalog/receiving_docks" className={buttonSecondaryClass}>
              {ts("docks")}
            </Link>
            <Link href="/catalog/transport_units" className={buttonSecondaryClass}>
              {ts("transport")}
            </Link>
            <Link href={docNewPath("inbound")} className={buttonClass}>
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
              {INBOUND_KINDS.map((code) => (
                <option key={code} value={code}>
                  {inboundKindLabel(code)}
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
            const href = docDetailPath("inbound", d.id);
            const status = d.status === "COMPLETED" ? "PLACED" : d.status;
            const docRow = d as Record<string, unknown>;
            const extras = extraByDoc[d.id] ?? {};
            return (
              <tr key={d.id} className="relative hover:bg-[var(--surface)]/60">
                {listColumns.map((col) => {
                  const value = formatListCellValue("inbound", col, docRow, extras);
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
                  <StatusBadge status={status} />
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
