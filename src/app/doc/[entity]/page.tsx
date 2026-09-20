import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InboundListView } from "@/components/doc-handlers/inbound-list";
import { OperationListView } from "@/components/doc-handlers/operation-list";
import { OutboundListView } from "@/components/doc-handlers/outbound-list";
import { displayCell, listCatalogRows } from "@/lib/meta/catalog";
import { isSystemDocumentEntity } from "@/lib/meta/document-registry";
import Link from "next/link";
import {
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonClass,
} from "@/components/ui";
import { docDetailPath, docNewPath } from "@/lib/meta/document-paths";

export default async function DocumentListPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { entity: entityCode } = await params;

  if (entityCode === "inbound") {
    return (
      <InboundListView
        searchParams={searchParams as Promise<{
          status?: string;
          kind?: string;
          q?: string;
        }>}
      />
    );
  }
  if (entityCode === "outbound") {
    return (
      <OutboundListView
        searchParams={searchParams as Promise<{
          status?: string;
          kind?: string;
          q?: string;
        }>}
      />
    );
  }
  if (entityCode === "operation") {
    return (
      <OperationListView
        searchParams={searchParams as Promise<{
          type?: string;
          q?: string;
          status?: string;
        }>}
      />
    );
  }

  if (isSystemDocumentEntity(entityCode)) notFound();

  const tc = await getTranslations("pages.common");
  const { entity, rows } = await listCatalogRows(entityCode);
  if (!entity || entity.kind !== "document" || entity.storage !== "custom") {
    notFound();
  }

  const listAttrs = entity.attributes.filter((a) => a.listVisible);
  const headers = listAttrs.map((a) => a.name);

  return (
    <Page key={entityCode}>
      <PageHeader
        title={entity.pluralName ?? entity.name}
        description={entity.description ?? undefined}
        actions={
          <Link href={docNewPath(entityCode)} className={buttonClass}>
            {tc("create")}
          </Link>
        }
      />

      <Panel flush>
        <DataTable
          headers={headers}
          empty={
            rows.length === 0 ? tc("emptyDocuments") : undefined
          }
        >
          {rows.map((row) => {
            const href = docDetailPath(entityCode, row.id);
            const label = displayCell(
              row,
              listAttrs[0]?.code ?? "number",
              listAttrs[0]?.type,
            );
            return (
              <tr
                key={row.id}
                className="relative hover:bg-[var(--surface)]/60"
              >
                {listAttrs.map((attr, index) => {
                  const text = displayCell(row, attr.code, attr.type);
                  return (
                    <td key={attr.id} className="px-3 py-2">
                      {index === 0 ? (
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
