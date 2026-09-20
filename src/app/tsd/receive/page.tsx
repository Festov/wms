import { TsdReceiveWizard } from "@/components/tsd-receive-wizard";
import { Page, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/check";
import { requireModule, isModuleFlagEnabled } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function TsdReceivePage() {
  await requireModule("inbound");
  await requirePermission("tsd.receive");
  const t = await getTranslations("pages.tsd");
  const [lotsEnabled, settings] = await Promise.all([
    isModuleFlagEnabled("lots"),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);
  return (
    <Page narrow>
      <PageHeader title={t("receive")} />
      <TsdReceiveWizard
        lotsEnabled={lotsEnabled}
        showPutawayAfterReceive={settings?.tsdShowPutawayAfterReceive ?? true}
      />
    </Page>
  );
}
