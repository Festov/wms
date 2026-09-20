import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ClickableTableRow,
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
import { formatDate } from "@/lib/format";
import { parseStatusList, formatStatusFilterLabel } from "@/lib/list-filters";
import {
  OPERATION_TYPES,
  operationTypeLabel,
} from "@/lib/operation-document";
import { syncPendingPutawayTasks } from "@/lib/operation-tasks";
import { docDetailPath, docListPath } from "@/lib/meta/document-paths";
import { listStatuses } from "@/lib/status";
import { requireModule } from "@/lib/session";
import type { OperationDocType, Prisma } from "@/generated/prisma/client";

function isOperationType(value: string): value is OperationDocType {
  return (OPERATION_TYPES as string[]).includes(value);
}

const STATUS_PRESET_KEYS = [
  { labelKey: "all", status: "" },
  { labelKey: "planned", status: "DRAFT" },
  { labelKey: "released", status: "RELEASED" },
  { labelKey: "completed", status: "POSTED,COMPLETED" },
] as const;

export async function OperationListView({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; status?: string }>;
}) {
  await requireModule("operations");
  const t = await getTranslations("components.docHandlers.operation");
  const ts = await getTranslations("components.shared");
  await syncPendingPutawayTasks();

  const { type: typeRaw, q: qRaw, status: statusRaw } = await searchParams;
  const typeFilter =
    typeRaw && isOperationType(typeRaw) ? typeRaw : undefined;
  const q = qRaw?.trim() ?? "";
  const statuses = parseStatusList(statusRaw);

  const where: Prisma.OperationDocumentWhereInput = {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { notes: { contains: q } },
            { pallet: { code: { contains: q } } },
            { inboundDocument: { number: { contains: q } } },
          ],
        }
      : {}),
  };

  const [docs, statusCatalog, counts] = await Promise.all([
    prisma.operationDocument.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 300,
      include: {
        createdBy: { select: { name: true, email: true } },
        inboundDocument: { select: { id: true, number: true } },
        pallet: { select: { code: true } },
        fromLocation: { select: { code: true } },
        toLocation: { select: { code: true } },
        _count: { select: { lines: true } },
      },
    }),
    listStatuses("putaway"),
    prisma.operationDocument.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;

  const filterParts: string[] = [];
  if (typeFilter) filterParts.push(operationTypeLabel(typeFilter));
  if (statuses) filterParts.push(formatStatusFilterLabel(statuses));
  if (q) filterParts.push(ts("searchFilter", { q }));
  const hasFilters = Boolean(typeFilter || statuses || q);
  const listPath = docListPath("operation");

  return (
    <Page>
      <PageHeader
        title={t("listTitle")}
        description={
          filterParts.length > 0
            ? ts("filterPrefix", { parts: filterParts.join(" · ") })
            : t("listDescription")
        }
      />

      <Panel title={ts("quickFilters")}>
        <div className="flex flex-wrap gap-2">
          {STATUS_PRESET_KEYS.map((preset) => {
            const href = preset.status
              ? `${listPath}?status=${preset.status}`
              : listPath;
            const active =
              !hasFilters &&
              (preset.status === ""
                ? !statuses
                : (statuses?.join(",") ?? "") === preset.status);
            return (
              <Link
                key={preset.labelKey}
                href={href}
                className={active ? buttonClass : buttonSecondaryClass}
              >
                {ts(preset.labelKey)}
                {preset.status === "RELEASED" && countByStatus.RELEASED
                  ? ` (${countByStatus.RELEASED})`
                  : null}
                {preset.status === "DRAFT" && countByStatus.DRAFT
                  ? ` (${countByStatus.DRAFT})`
                  : null}
              </Link>
            );
          })}
        </div>
      </Panel>

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
            <select className={inputClass} name="type" defaultValue={typeFilter ?? ""}>
              <option value="">{ts("allTypes")}</option>
              {OPERATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {operationTypeLabel(t)}
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
                  {countByStatus[s.code] != null
                    ? ` (${countByStatus[s.code]})`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <button type="submit" className={buttonClass}>
              {ts("find")}
            </button>
            {hasFilters ? (
              <Link href={listPath} className={buttonSecondaryClass}>
                {ts("reset")}
              </Link>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel flush title={ts("tasksAndDocs", { count: docs.length })}>
        <DataTable
          headers={[
            ts("number"),
            ts("type"),
            ts("status"),
            ts("order"),
            ts("pallet"),
            ts("route"),
            ts("who"),
            ts("updated"),
            ts("lines"),
          ]}
          empty={
            docs.length === 0
              ? hasFilters
                ? ts("noRowsFiltered")
                : ts("noTasks")
              : undefined
          }
        >
          {docs.map((op) => {
            const who = op.createdBy
              ? op.createdBy.name ||
                (op.createdBy.email.includes("@")
                  ? op.createdBy.email.split("@")[0]
                  : op.createdBy.email)
              : "—";
            const route =
              op.fromLocation || op.toLocation
                ? ts("fromTo", {
                    from: op.fromLocation?.code ?? "—",
                    to: op.toLocation?.code ?? "—",
                  })
                : "—";
            return (
              <ClickableTableRow
                key={op.id}
                href={docDetailPath("operation", op.id)}
                label={ts("openDocument", { number: op.number })}
              >
                <td className="px-3 py-2 font-medium">{op.number}</td>
                <td className="px-3 py-2">{operationTypeLabel(op.type)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={op.status} />
                </td>
                <td className="px-3 py-2">{op.inboundDocument?.number ?? "—"}</td>
                <td className="px-3 py-2">{op.pallet?.code ?? "—"}</td>
                <td className="px-3 py-2">{route}</td>
                <td className="px-3 py-2">{who}</td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {formatDate(op.updatedAt)}
                </td>
                <td className="px-3 py-2">{op._count.lines}</td>
              </ClickableTableRow>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
