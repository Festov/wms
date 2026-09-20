import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader, Panel, buttonClass } from "@/components/ui";

export default async function ModuleDisabled({
  title,
  moduleName,
}: {
  title: string;
  moduleName: string;
}) {
  const t = await getTranslations("components.moduleDisabled");

  return (
    <div>
      <PageHeader title={title} />
      <Panel className="max-w-xl">
        <p className="text-sm text-[var(--muted)]">
          {t("message", { moduleName })}
        </p>
        <Link href="/settings" className={`${buttonClass} mt-4`}>
          {t("toSettings")}
        </Link>
      </Panel>
    </div>
  );
}
