import { TsdDeviceForm } from "@/components/tsd-device-form";
import { Page, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function TsdDevicePage() {
  await requireUser();
  const t = await getTranslations("pages.tsd");
  return (
    <Page narrow>
      <PageHeader title={t("device")} />
      <TsdDeviceForm />
    </Page>
  );
}
