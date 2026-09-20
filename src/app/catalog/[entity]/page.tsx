import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonClass,
} from "@/components/ui";
import { displayCell, listCatalogRows } from "@/lib/meta/catalog";
import { requireUser } from "@/lib/session";

export default async function CatalogListPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  await requireUser();
  const { entity: entityCode } = await params;
  const tc = await getTranslations("pages.common");
  const { entity, rows } = await listCatalogRows(entityCode);
  if (!entity || entity.kind === "document") notFound();

  const listAttrs = entity.attributes.filter((a) => a.listVisible);
  const headers = listAttrs.map((a) => a.name);

  return (
    <Page key={entityCode}>
      <PageHeader
        title={entity.pluralName ?? entity.name}
        description={entity.description ?? undefined}
        actions={
          <>
            {entityCode === "cells" ? (
              <Link
                href={`/catalog/${entityCode}/rack`}
                className={buttonClass}
              >
                {tc("createRack")}
              </Link>
            ) : null}
            <Link href={`/catalog/${entityCode}/new`} className={buttonClass}>
              {entityCode === "cells" ? tc("createCell") : tc("create")}
            </Link>
          </>
        }
      />

      <Panel flush>
        <DataTable
          headers={headers}
          empty={rows.length === 0 ? tc("emptyCatalog") : undefined}
        >
          {rows.map((row) => {
            const href = `/catalog/${entityCode}/${row.id}`;
            const label = displayCell(
              row,
              listAttrs[0]?.systemField ?? listAttrs[0]?.code ?? "id",
              listAttrs[0]?.type,
            );
            return (
              <tr
                key={row.id}
                className="relative hover:bg-[var(--surface)]/60"
              >
                {listAttrs.map((attr, i) => {
                  const field = attr.systemField ?? attr.code;
                  const text = displayCell(row, field, attr.type);
                  return (
                    <td key={attr.id} className="px-3 py-2">
                      {i === 0 ? (
                        <Link
                          href={href}
                          aria-label={tc("openAria", { label })}
                          className="after:absolute after:inset-0 after:content-['']"
                        >
                          <span className="relative z-10 font-medium">
                            {text}
                          </span>
                        </Link>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
