import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Page, PageGrid, PageHeader, Panel } from "@/components/ui";
import { ADMIN_HUB_CARDS } from "@/lib/admin/nav";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminHubPage() {
  await requireAdmin();
  const t = await getTranslations("pages.admin");

  const [users, roles, statuses, metaEntities, navItems, outbox, inbox] =
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.status.count(),
      prisma.metaEntity.count({ where: { isActive: true } }),
      prisma.navItem.count(),
      prisma.integrationOutbox.count({ where: { status: "pending" } }),
      prisma.integrationInbox.count({ where: { status: "failed" } }),
    ]);

  const counts: Record<string, number | string> = {
    "/settings": t("counts.warehouse"),
    "/admin/users": users,
    "/admin/roles": roles,
    "/admin/statuses": statuses,
    "/admin/meta": metaEntities,
    "/admin/nav": navItems,
    "/admin/integration": `${outbox} / ${inbox}`,
    "/admin/putaway": t("counts.rules"),
  };

  return (
    <Page>
      <PageHeader title={t("title")} description={t("description")} />

      <PageGrid cols={4}>
        {ADMIN_HUB_CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <Panel className="h-full transition hover:border-[var(--accent)]">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {counts[card.href] ?? "—"}
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                {t(`hubCards.${card.href}.title`)}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {t(`hubCards.${card.href}.hint`)}
              </p>
            </Panel>
          </Link>
        ))}
      </PageGrid>
    </Page>
  );
}
