import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader, Panel, buttonClass } from "@/components/ui";

export default async function ForbiddenPage() {
  const t = await getTranslations("pages.forbidden");

  return (
    <Page>
      <PageHeader title={t("title")} />
      <Panel>
        <p className="text-sm text-[var(--muted)]">{t("message")}</p>
        <Link href="/nsi" className={`${buttonClass} mt-4`}>
          {t("linkToNsi")}
        </Link>
      </Panel>
    </Page>
  );
}
