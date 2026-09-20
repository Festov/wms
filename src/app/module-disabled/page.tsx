import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader, Panel, buttonClass } from "@/components/ui";

export default async function ModuleDisabledPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const t = await getTranslations("pages.moduleDisabled");
  const tc = await getTranslations("pages.common");

  return (
    <Page>
      <PageHeader title={t("title")} />
      <Panel>
        <p className="text-sm text-[var(--muted)]">
          {code ? t("messageWithCode", { code }) : t("message")}
        </p>
        <Link href="/settings" className={`${buttonClass} mt-4`}>
          {tc("toSettings")}
        </Link>
      </Panel>
    </Page>
  );
}
