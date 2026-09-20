import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ClickableTableRow,
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonSecondaryClass,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, movementTypeLabel } from "@/lib/format";
import { resolveMovementTaskHrefs } from "@/lib/movement-task-link";
import { requireModule } from "@/lib/session";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("lots");
  const { id } = await params;
  const t = await getTranslations("pages.lots");
  const tc = await getTranslations("pages.common");
  const tu = await getTranslations("units");

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      product: { include: { unit: true } },
      balances: {
        where: { quantity: { not: 0 } },
        include: {
          location: { include: { zone: true } },
          pallet: true,
          package: true,
        },
        orderBy: { location: { code: "asc" } },
      },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          product: { include: { unit: true } },
          fromLocation: true,
          toLocation: true,
        },
      },
    },
  });
  if (!lot) notFound();

  const unit = lot.product.unit?.symbol || lot.product.unit?.name || tu("pcs");
  const totalQty = lot.balances.reduce((sum, b) => sum + b.quantity, 0);
  const movementLinks = await resolveMovementTaskHrefs(lot.movements);

  return (
    <Page>
      <PageHeader
        title={lot.number}
        description={`${lot.product.sku} · ${lot.product.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/lots/${id}/edit`} className={buttonClass}>
              {tc("edit")}
            </Link>
            <Link
              href={`/catalog/nomenclature/${lot.productId}`}
              className={buttonSecondaryClass}
            >
              {tc("product")}
            </Link>
            <Link href="/lots" className={buttonSecondaryClass}>
              {tc("toList")}
            </Link>
          </div>
        }
      />

      <Panel title={tc("details")}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted)]">{t("expiryDate")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {lot.expiryDate
                ? formatDate(lot.expiryDate).slice(0, 10)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{t("manufactured")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {lot.manufacturedAt
                ? formatDate(lot.manufacturedAt).slice(0, 10)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{t("createdAt")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {formatDate(lot.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{t("balance")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {totalQty} {unit}
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel
        flush
        title={t("balancesByLocation", { count: lot.balances.length })}
      >
        <DataTable
          headers={[
            t("zone"),
            t("location"),
            t("pallet"),
            t("package"),
            t("quantity"),
          ]}
          empty={lot.balances.length === 0 ? t("noBalances") : undefined}
        >
          {lot.balances.map((balance) => (
            <ClickableTableRow
              key={balance.id}
              href={`/catalog/cells/${balance.locationId}`}
              label={tc("openCell", { code: balance.location.code })}
            >
              <td className="px-3 py-2">
                {balance.location.zone?.name ?? "—"}
              </td>
              <td className="px-3 py-2">{balance.location.code}</td>
              <td className="px-3 py-2">{balance.pallet?.code ?? "—"}</td>
              <td className="px-3 py-2">{balance.package?.name ?? "—"}</td>
              <td className="px-3 py-2 font-medium">
                {balance.quantity} {unit}
              </td>
            </ClickableTableRow>
          ))}
        </DataTable>
      </Panel>

      <Panel flush title={t("recentMovements")}>
        <DataTable
          headers={[
            t("when"),
            t("type"),
            t("from"),
            t("to"),
            t("quantity"),
            t("note"),
          ]}
          empty={
            lot.movements.length === 0 ? t("noMovements") : undefined
          }
        >
          {lot.movements.map((movement) => {
            const taskHref = movementLinks.get(movement.id);
            return (
              <ClickableTableRow
                key={movement.id}
                href={taskHref ?? undefined}
                label={taskHref ? tc("openOperation") : undefined}
              >
                <td className="px-3 py-2 text-[var(--muted)]">
                  {formatDate(movement.createdAt)}
                </td>
                <td className="px-3 py-2">
                  {movementTypeLabel(movement.type)}
                </td>
                <td className="px-3 py-2">
                  {movement.fromLocation?.code ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {movement.toLocation?.code ?? "—"}
                </td>
                <td className="px-3 py-2">{movement.quantity}</td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {movement.note ?? "—"}
                </td>
              </ClickableTableRow>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
