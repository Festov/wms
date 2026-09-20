import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader, buttonSecondaryClass } from "@/components/ui";
import { RackConfigForm } from "@/components/rack-config-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function CellsRackPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  await requireUser();
  const { entity } = await params;
  if (entity !== "cells") notFound();
  const t = await getTranslations("pages.catalog");
  const tc = await getTranslations("pages.common");

  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const zoneTypeLabel = (type: string) => {
    switch (type) {
      case "RECEIVING":
        return tc("zoneTypeReceiving");
      case "SHIPPING":
        return tc("zoneTypeShipping");
      case "QUARANTINE":
        return tc("zoneTypeQuarantine");
      default:
        return tc("zoneTypeStorage");
    }
  };

  return (
    <Page>
      <PageHeader
        title={t("rackTitle")}
        actions={
          <Link href="/catalog/cells" className={buttonSecondaryClass}>
            {tc("toList")}
          </Link>
        }
      />
      <RackConfigForm
        returnTo="/catalog/cells"
        zones={zones.map((z) => ({
          id: z.id,
          label: `${z.name} · ${zoneTypeLabel(z.type)}`,
        }))}
      />
    </Page>
  );
}
