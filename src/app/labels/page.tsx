import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LabelsBarcodeList } from "@/components/labels-barcode-list";
import {
  Page,
  PageHeader,
  buttonSecondaryClass,
} from "@/components/ui";
import { listBarcodeCatalog } from "@/lib/barcode-catalog";
import { requireUser } from "@/lib/session";

export default async function LabelsPage() {
  await requireUser();
  const t = await getTranslations("pages.labels");
  const tc = await getTranslations("pages.common");
  const entries = await listBarcodeCatalog();

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/nsi" className={buttonSecondaryClass}>
            {tc("nsi")}
          </Link>
        }
      />

      <LabelsBarcodeList entries={entries} />
    </Page>
  );
}
