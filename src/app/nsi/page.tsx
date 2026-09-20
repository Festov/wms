import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Page, PageGrid, PageHeader, Panel } from "@/components/ui";
import { prisma } from "@/lib/db";
import { filterNsiHubCards } from "@/lib/nsi/nav";
import { listBarcodeCatalog } from "@/lib/barcode-catalog";
import { getUserAllowedModules, getUserPermissionSet } from "@/lib/permissions/check";
import { nsiCatalogViewPermission, nsiDocumentViewPermission } from "@/lib/menu/permissions";
import { catalogNavHref, documentNavHref } from "@/lib/nav/helpers";
import { getModuleFlags, requireUser } from "@/lib/session";

export default async function NsiHubPage() {
  const user = await requireUser();
  const flags = await getModuleFlags();
  const t = await getTranslations("pages.nsi");
  const tc = await getTranslations("pages.common");
  const [allowed, permissions] = await Promise.all([
    getUserAllowedModules(user.id),
    getUserPermissionSet(user.id),
  ]);
  const cards = filterNsiHubCards({
    topology: flags.topology,
    lots: flags.lots,
    allowedTopology: allowed.has("topology"),
    allowedLots: allowed.has("lots"),
    permissions,
  });

  const [
    products,
    counterparties,
    zones,
    cells,
    palletTypes,
    pallets,
    packages,
    units,
    accountingModels,
    lots,
    receivingDocks,
    transportUnits,
    custom,
    barcodes,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.counterparty.count(),
    prisma.zone.count(),
    prisma.location.count(),
    prisma.palletType.count(),
    prisma.pallet.count(),
    prisma.package.count(),
    prisma.unit.count(),
    prisma.accountingModel.count(),
    flags.lots ? prisma.lot.count() : Promise.resolve(0),
    prisma.receivingDock.count(),
    prisma.transportUnit.count(),
    prisma.metaEntity.findMany({
      where: { storage: "custom", isActive: true, navItemCode: null },
      include: { _count: { select: { records: true } } },
    }),
    listBarcodeCatalog(),
  ]);

  const counts: Record<string, number> = {
    products,
    counterparties,
    receivingDocks,
    transportUnits,
    zones,
    cells,
    palletTypes,
    pallets,
    packages,
    units,
    accountingModels,
    lots,
    topology: cells,
    labels: barcodes.length,
  };

  return (
    <Page>
      <PageHeader title={t("title")} description={t("description")} />

      <PageGrid cols={4}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Panel className="h-full transition hover:border-[var(--accent)]">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tc("recordsCount", { count: counts[card.key] ?? 0 })}
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                {t(`hubCards.${card.key}.title`)}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {t(`hubCards.${card.key}.hint`)}
              </p>
            </Panel>
          </Link>
        ))}
        {custom
          .filter(
            (e) =>
              e.kind === "catalog" &&
              permissions.has(nsiCatalogViewPermission(e.code)),
          )
          .map((e) => (
          <Link key={e.id} href={catalogNavHref(e.code)}>
            <Panel className="h-full transition hover:border-[var(--accent)]">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tc("catalogBadge", { count: e._count.records })}
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                {e.pluralName ?? e.name}
              </h3>
              {e.description ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {e.description}
                </p>
              ) : null}
            </Panel>
          </Link>
        ))}
        {custom
          .filter(
            (e) =>
              e.kind === "document" &&
              permissions.has(nsiDocumentViewPermission(e.code)),
          )
          .map((e) => (
          <Link key={e.id} href={documentNavHref(e.code)}>
            <Panel className="h-full transition hover:border-[var(--accent)]">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tc("documentBadge", { count: e._count.records })}
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                {e.pluralName ?? e.name}
              </h3>
              {e.description ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {e.description}
                </p>
              ) : null}
            </Panel>
          </Link>
        ))}
      </PageGrid>
    </Page>
  );
}
