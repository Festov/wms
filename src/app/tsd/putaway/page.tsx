import { TsdPutawayWizard } from "@/components/tsd-putaway-wizard";
import { Page, PageHeader } from "@/components/ui";
import {
  requirePermission,
  userHasPermission,
} from "@/lib/permissions/check";
import { getTranslations } from "next-intl/server";

export default async function TsdPutawayPage() {
  const user = await requirePermission("tsd.putaway");
  const t = await getTranslations("pages.tsd");
  const allowFreePutaway = await userHasPermission(
    user.id,
    "tsd.freePutawayScan",
  );

  return (
    <Page narrow>
      <PageHeader title={t("putaway")} />
      <TsdPutawayWizard allowFreePutaway={allowFreePutaway} />
    </Page>
  );
}
