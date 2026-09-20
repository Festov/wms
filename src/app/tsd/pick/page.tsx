import { TsdScanForm } from "@/components/tsd-scan-form";
import { Page, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions/check";
import { requireModule, isModuleFlagEnabled } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function TsdPickPage() {
  await requireModule("outbound");
  await requirePermission("tsd.pick");
  const t = await getTranslations("pages.tsd");
  const lotsEnabled = await isModuleFlagEnabled("lots");
  return (
    <Page narrow>
      <PageHeader title={t("pick")} />
      <TsdScanForm mode="pick" lotsEnabled={lotsEnabled} />
    </Page>
  );
}
