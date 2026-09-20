import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CustomDocumentAddLineForm } from "@/components/custom-document-add-line-form";
import { Page, PageHeader, buttonSecondaryClass } from "@/components/ui";
import { updateCustomDocumentLineAction } from "@/lib/meta/actions";
import { getCatalogRow } from "@/lib/meta/catalog";
import {
  getCustomDocumentLine,
  loadCustomDocumentLines,
} from "@/lib/meta/custom-lines";
import { hasCapability } from "@/lib/meta/document-registry";
import { docDetailPath } from "@/lib/meta/document-paths";

export default async function DocumentLineEditPage({
  params,
}: {
  params: Promise<{ entity: string; id: string; lineId: string }>;
}) {
  const { entity, id, lineId } = await params;
  const tc = await getTranslations("pages.common");
  const tCommon = await getTranslations("common");

  const { entity: customEntity, row } = await getCatalogRow(entity, id);
  if (
    !customEntity ||
    !row ||
    customEntity.kind !== "document" ||
    customEntity.storage !== "custom" ||
    !hasCapability(customEntity, "lines")
  ) {
    notFound();
  }

  const existing = await getCustomDocumentLine(entity, id, lineId);
  if (!existing) notFound();

  const { refOptions } = await loadCustomDocumentLines(id, entity);

  async function action(formData: FormData) {
    "use server";
    await updateCustomDocumentLineAction(entity, id, lineId, formData);
  }

  const title = String(row.number ?? row.title ?? customEntity.name);

  return (
    <Page>
      <PageHeader
        title={tc("editLineTitle", { title, lineNo: existing.line.lineNo })}
        actions={
          <Link href={docDetailPath(entity, id)} className={buttonSecondaryClass}>
            {tc("toDocument")}
          </Link>
        }
      />
      <CustomDocumentAddLineForm
        action={action}
        columns={existing.lineDef.columns}
        refOptions={refOptions}
        values={existing.data}
        submitLabel={tCommon("save")}
      />
    </Page>
  );
}
