import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageGrid, PageHeader, Panel } from "@/components/ui";
import { prisma } from "@/lib/db";
import {
  catalogNavHref,
  documentNavHref,
  navItemIconCode,
} from "@/lib/nav/helpers";
import { requireUser } from "@/lib/session";

export default async function NavHubPage({
  params,
}: {
  params: Promise<{ nav: string }>;
}) {
  await requireUser();
  const { nav } = await params;
  const navCode = navItemIconCode(nav);
  const t = await getTranslations("pages.navHub");
  const tc = await getTranslations("pages.common");

  const [navItem, entities] = await Promise.all([
    prisma.navItem.findFirst({
      where: { code: navCode, isActive: true },
    }),
    prisma.metaEntity.findMany({
      where: { navItemCode: navCode, storage: "custom", isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { records: true } } },
    }),
  ]);

  if (!navItem) notFound();

  const catalogs = entities.filter((entity) => entity.kind === "catalog");
  const documents = entities.filter((entity) => entity.kind === "document");

  return (
    <Page>
      <PageHeader title={navItem.label} description={t("description")} />

      {entities.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">{t("empty")}</p>
        </Panel>
      ) : (
        <PageGrid cols={4}>
          {catalogs.map((entity) => (
            <Link key={entity.id} href={catalogNavHref(entity.code)}>
              <Panel className="h-full transition hover:border-[var(--accent)]">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {tc("catalogBadge", { count: entity._count.records })}
                </p>
                <h3 className="mt-2 text-lg font-semibold">
                  {entity.pluralName ?? entity.name}
                </h3>
                {entity.description ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {entity.description}
                  </p>
                ) : null}
              </Panel>
            </Link>
          ))}
          {documents.map((entity) => (
            <Link key={entity.id} href={documentNavHref(entity.code)}>
              <Panel className="h-full transition hover:border-[var(--accent)]">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {tc("documentBadge", { count: entity._count.records })}
                </p>
                <h3 className="mt-2 text-lg font-semibold">
                  {entity.pluralName ?? entity.name}
                </h3>
                {entity.description ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {entity.description}
                  </p>
                ) : null}
              </Panel>
            </Link>
          ))}
        </PageGrid>
      )}
    </Page>
  );
}
