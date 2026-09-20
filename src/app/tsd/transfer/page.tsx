import { TsdScanForm } from "@/components/tsd-scan-form";
import { Page, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/permissions/check";
import { isModuleFlagEnabled } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function TsdTransferPage() {
  await requirePermission("tsd.transfer");
  const t = await getTranslations("pages.tsd");
  const lotsEnabled = await isModuleFlagEnabled("lots");
  return (
    <Page narrow>
      <PageHeader title={t("transfer")} />
      <TsdScanForm mode="transfer" lotsEnabled={lotsEnabled} />
    </Page>
  );
}
