import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { InboundDetailView } from "@/components/doc-handlers/inbound-detail";
import { OperationDetailView } from "@/components/doc-handlers/operation-detail";
import { OutboundDetailView } from "@/components/doc-handlers/outbound-detail";
import {
  MetaRecordFields,
  buildMetaRecordSections,
} from "@/components/meta-record-fields";
import { MetaDocumentLinesTable } from "@/components/meta-document-lines";
import { isSystemDocumentEntity, hasCapability } from "@/lib/meta/document-registry";
import {
  deleteCustomDocumentLineAction,
  updateDocumentRecord,
} from "@/lib/meta/actions";
import { getCatalogRow, listRefOptions } from "@/lib/meta/catalog";
import { loadCustomDocumentLines } from "@/lib/meta/custom-lines";
import {
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonSecondaryClass,
} from "@/components/ui";
import {
  docLineEditPath,
  docLineNewPath,
  docListPath,
} from "@/lib/meta/document-paths";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ entity: string; id: string }>;
}) {
  const { entity: entityCode, id } = await params;
  const tc = await getTranslations("pages.common");
  const tSave = await getTranslations("common");

  if (entityCode === "inbound") return <InboundDetailView id={id} />;
  if (entityCode === "outbound") return <OutboundDetailView id={id} />;
  if (entityCode === "operation") return <OperationDetailView id={id} />;

  if (isSystemDocumentEntity(entityCode)) notFound();

  const { entity, row } = await getCatalogRow(entityCode, id);
  if (
    !entity ||
    !row ||
    entity.kind !== "document" ||
    entity.storage !== "custom"
  ) {
    notFound();
  }

  const refOptions: Record<string, { id: string; label: string }[]> = {};
  for (const attr of entity.attributes) {
    if (attr.type === "ref" && attr.refEntityCode) {
      refOptions[attr.code] = await listRefOptions(attr.refEntityCode);
    }
  }

  const recordSections = buildMetaRecordSections(entity, entity.sections);
  const title = String(row.number ?? row.title ?? entity.name);
  const showLines = hasCapability(entity, "lines");
  const { lineDef, rows: lineRows } = showLines
    ? await loadCustomDocumentLines(id, entityCode)
    : { lineDef: null, rows: [] };

  async function action(formData: FormData) {
    "use server";
    await updateDocumentRecord(entityCode, id, formData);
  }

  return (
    <Page key={`${entityCode}:${id}`}>
      <PageHeader
        title={title}
        description={entity.name}
        actions={
          <Link href={docListPath(entityCode)} className={buttonSecondaryClass}>
            {tc("toList")}
          </Link>
        }
      />

      <form action={action} className="space-y-4">
        <MetaRecordFields
          sections={recordSections}
          refOptions={refOptions}
          values={row}
          layout="panels"
        />
        <button className={buttonClass} type="submit">
          {tSave("save")}
        </button>
      </form>

      {showLines && lineDef ? (
        <Panel flush title={tc("lines")} className="mt-4">
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <Link
              href={docLineNewPath(entityCode, id)}
              className={buttonSecondaryClass}
            >
              {tc("addLine")}
            </Link>
          </div>
          <MetaDocumentLinesTable
            columns={lineDef.columns}
            rows={lineRows}
            title=""
            empty={tc("noLines")}
            actionsHeader={tc("actions")}
            renderRowActions={(row) => {
              const lineId = String(row.id ?? "");
              if (!lineId) return null;
              return (
                <>
                  <Link
                    href={docLineEditPath(entityCode, id, lineId)}
                    className={buttonSecondaryClass}
                  >
                    {tc("edit")}
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await deleteCustomDocumentLineAction(
                        entityCode,
                        id,
                        lineId,
                      );
                    }}
                  >
                    <button type="submit" className={buttonSecondaryClass}>
                      {tc("delete")}
                    </button>
                  </form>
                </>
              );
            }}
          />
        </Panel>
      ) : null}
    </Page>
  );
}
