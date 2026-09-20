import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, Page, PageHeader, Panel } from "@/components/ui";
import { listMetaEntities } from "@/lib/meta/catalog";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { resolveLocale } from "@/i18n/config";
import { resolveMetaEntityName } from "@/lib/i18n/seed-labels";
import { CreateCustomEntityButton } from "./create-custom-entity-button";
import { CreateCustomDocumentButton } from "./create-custom-document-button";

export default async function AdminMetaPage() {
  await requireAdmin();
  const locale = resolveLocale(await getLocale());
  const t = await getTranslations("pages.admin.meta");

  const [entities, navSections] = await Promise.all([
    listMetaEntities(),
    prisma.navItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { code: true, label: true },
    }),
  ]);

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CreateCustomEntityButton navSections={navSections} />
            <CreateCustomDocumentButton navSections={navSections} />
          </div>
        }
      />

      <Panel flush>
        <DataTable
          headers={[
            t("code"),
            t("name"),
            t("kind"),
            t("storage"),
            t("attributes"),
            "",
          ]}
        >
          {entities.map((e) => (
            <tr key={e.id} className="hover:bg-[var(--surface)]/60">
              <td className="px-3 py-2">{e.code}</td>
              <td className="px-3 py-2 font-medium">
                {resolveMetaEntityName(e.code, e.name, locale)}
              </td>
              <td className="px-3 py-2">{e.kind}</td>
              <td className="px-3 py-2">{e.storage}</td>
              <td className="px-3 py-2">{e._count.attributes}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/meta/${e.code}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  {t("open")}
                </Link>
                {e.kind === "document" ? (
                  <>
                    {" · "}
                    <Link
                      href={`/doc/${e.code}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {t("document")}
                    </Link>
                  </>
                ) : (
                  <>
                    {" · "}
                    <Link
                      href={`/catalog/${e.code}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {t("catalog")}
                    </Link>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </Page>
  );
}
