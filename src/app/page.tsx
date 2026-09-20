import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ClickableTableRow,
  DataTable,
  OverviewFlowSection,
  Page,
  PageHeader,
  Panel,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, movementTypeLabel } from "@/lib/format";
import {
  formatMovementQuantity,
  movementRouteText,
} from "@/lib/movement-summary";
import { resolveMovementTaskHrefs } from "@/lib/movement-task-link";
import { getAppSetting } from "@/lib/settings/storage";
import { getUserAllowedModules } from "@/lib/permissions/check";
import { requireUser, getModuleFlags } from "@/lib/session";

export default async function OverviewPage() {
  const user = await requireUser();
  const flags = await getModuleFlags();
  const allowedModules = await getUserAllowedModules(user.id);
  const recentMovementsLimit = await getAppSetting("overviewRecentMovementsLimit");
  const t = await getTranslations("pages.overview");
  const tc = await getTranslations("pages.common");
  const tm = await getTranslations("modules");

  const [
    movements,
    inboundPlanned,
    inboundInProgress,
    outboundPlanned,
    outboundInProgress,
    operationsDraft,
    operationsReleased,
  ] = await Promise.all([
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: recentMovementsLimit,
      include: {
        product: { include: { unit: true } },
        toLocation: true,
        fromLocation: true,
      },
    }),
    flags.inbound
      ? prisma.inboundDocument.count({ where: { status: "DRAFT" } })
      : Promise.resolve(0),
    flags.inbound
      ? prisma.inboundDocument.count({
          where: { status: "RELEASED" },
        })
      : Promise.resolve(0),
    flags.outbound
      ? prisma.outboundDocument.count({ where: { status: "DRAFT" } })
      : Promise.resolve(0),
    flags.outbound
      ? prisma.outboundDocument.count({ where: { status: "RELEASED" } })
      : Promise.resolve(0),
    allowedModules.has("operations") && flags.operations
      ? prisma.operationDocument.count({ where: { status: "DRAFT" } })
      : Promise.resolve(0),
    allowedModules.has("operations") && flags.operations
      ? prisma.operationDocument.count({ where: { status: "RELEASED" } })
      : Promise.resolve(0),
  ]);

  const operationsPlanned = operationsDraft;
  const operationsPlannedHint = t("newTasks");

  const movementLinks = await resolveMovementTaskHrefs(movements);

  const flowSections = [
    ...(flags.inbound
      ? [
          {
            title: tm("inbound"),
            href: "/doc/inbound",
            metrics: [
              {
                label: t("planned"),
                value: inboundPlanned,
                hint: t("newOrders"),
                href: "/doc/inbound?status=DRAFT",
              },
              {
                label: t("inProgress"),
                value: inboundInProgress,
                hint: t("toExecuteWarehouse"),
                href: "/doc/inbound?status=RELEASED",
              },
            ],
          },
        ]
      : []),
    ...(flags.outbound
      ? [
          {
            title: tm("outbound"),
            href: "/doc/outbound",
            metrics: [
              {
                label: t("planned"),
                value: outboundPlanned,
                hint: t("newOrders"),
                href: "/doc/outbound?status=DRAFT",
              },
              {
                label: t("inProgress"),
                value: outboundInProgress,
                hint: t("toExecuteShort"),
                href: "/doc/outbound?status=RELEASED",
              },
            ],
          },
        ]
      : []),
    ...(allowedModules.has("operations") && flags.operations
      ? [
          {
            title: t("internalOperations"),
            href: "/doc/operation",
            metrics: [
              {
                label: t("planned"),
                value: operationsPlanned,
                hint: operationsPlannedHint,
                href: "/doc/operation?status=DRAFT",
              },
              {
                label: t("toExecute"),
                value: operationsReleased,
                hint: t("operationsHint"),
                href: "/doc/operation?status=RELEASED",
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <Page>
      <PageHeader title={t("title")} description={t("description")} />

      {flowSections.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">
            {t("noFlows")}{" "}
            <Link href="/settings" className="text-[var(--accent)] hover:underline">
              {t("settingsLink")}
            </Link>
            .
          </p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          {flowSections.map((section) => (
            <OverviewFlowSection
              key={section.title}
              title={section.title}
              href={section.href}
              metrics={section.metrics}
            />
          ))}
        </div>
      )}

      <Panel
        flush
        title={t("recentMovements")}
        actions={
          <span className="text-xs text-[var(--muted)]">
            {t("movementsLimit", { limit: recentMovementsLimit })}
          </span>
        }
      >
        <DataTable
          headers={[
            t("when"),
            t("operation"),
            t("product"),
            t("quantity"),
            t("note"),
          ]}
          empty={movements.length === 0 ? t("noMovements") : undefined}
        >
          {movements.map((m) => {
            const taskHref = movementLinks.get(m.id);
            return (
              <ClickableTableRow
                key={m.id}
                href={taskHref ?? undefined}
                label={
                  taskHref
                    ? tc("openTask", { sku: m.product.sku })
                    : undefined
                }
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-[var(--muted)]">
                  {formatDate(m.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{movementTypeLabel(m.type)}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {movementRouteText(m)}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{m.product.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {m.product.sku}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums">
                  {formatMovementQuantity(m)}
                </td>
                <td
                  className="max-w-[14rem] truncate px-3 py-2.5 text-xs text-[var(--muted)]"
                  title={m.note ?? undefined}
                >
                  {m.note ?? "—"}
                </td>
              </ClickableTableRow>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
