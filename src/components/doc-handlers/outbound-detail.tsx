import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Page,
  PageHeader,
  Panel,
  buttonSecondaryClass,
} from "@/components/ui";
import { MetaDocumentLinesTable } from "@/components/meta-document-lines";
import { DocumentStatusControl } from "@/components/document-status-control";
import { OutboundStatusHistoryPanel } from "@/components/outbound-status-history-panel";
import { MetaRecordFields } from "@/components/meta-record-fields";
import { documentStatusTransitionsForUi } from "@/lib/document-status-ui";
import { formatReceivingDockLabel } from "@/lib/receiving-dock";
import { formatTransportUnitLabel } from "@/lib/transport-unit";
import { prisma } from "@/lib/db";
import {
  docLineNewPath,
  docListPath,
} from "@/lib/meta/document-paths";
import { saveDocumentFromForm } from "@/lib/meta/document-handlers";
import { loadLineDefinition } from "@/lib/meta/lines";
import {
  extraSectionAttributes,
  getDocumentFormAttributes,
  loadDocumentExtraRefOptions,
  loadDocumentFormValues,
  mergeDetailSections,
} from "@/lib/meta/document-form";
import { requireModule, isModuleFlagEnabled } from "@/lib/session";

export async function OutboundDetailView({ id }: { id: string }) {
  await requireModule("outbound");
  const t = await getTranslations("components.docHandlers.outbound");
  const ts = await getTranslations("components.shared");
  const lotsEnabled = await isModuleFlagEnabled("lots");

  const [
    { sections: formSections },
    formValues,
    doc,
    customers,
    statusHistory,
    docks,
    transportUnits,
    lineDef,
  ] = await Promise.all([
    getDocumentFormAttributes("outbound"),
    loadDocumentFormValues("outbound", id),
    prisma.outboundDocument.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            product: true,
            location: true,
            lot: true,
            package: { include: { unit: true } },
          },
        },
      },
    }),
    prisma.counterparty.findMany({
      where: {
        isActive: true,
        OR: [{ kind: "CUSTOMER" }, { kind: "BOTH" }],
      },
      orderBy: { name: "asc" },
    }),
    prisma.outboundStatusHistory.findMany({
      where: { documentId: id },
      orderBy: { changedAt: "desc" },
      include: { changedBy: { select: { name: true, email: true } } },
    }),
    prisma.receivingDock.findMany({
      where: { isActive: true },
      orderBy: [{ status: "asc" }, { code: "asc" }],
      include: { zone: true },
    }),
    prisma.transportUnit.findMany({
      where: { isActive: true },
      orderBy: { plateNumber: "asc" },
    }),
    loadLineDefinition("outbound"),
  ]);

  if (!doc) notFound();

  const extraRefOptions = await loadDocumentExtraRefOptions("outbound");
  const detailSections = mergeDetailSections(formSections);
  const extraAttrs = extraSectionAttributes(formSections);
  const cancelled = doc.status === "CANCELLED";
  const posted = doc.status === "POSTED";
  const draft = doc.status === "DRAFT";
  const statusTransitions = await documentStatusTransitionsForUi(
    "outbound",
    id,
    doc.status,
    doc.lines.length,
  );

  const historyViews = statusHistory.map((entry) => ({
    id: entry.id,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    changedAt: entry.changedAt.toISOString(),
    source: entry.source,
    note: entry.note,
    changedByName: entry.changedBy
      ? entry.changedBy.name ||
        (entry.changedBy.email.includes("@")
          ? entry.changedBy.email.split("@")[0]
          : entry.changedBy.email)
      : null,
  }));

  const lineRows = doc.lines.map((l) => ({
    id: l.id,
    lineNo: l.lineNo,
    product: l.product,
    package: l.package
      ? `${l.package.name}${l.packageQty != null ? ` · ${l.packageQty}` : ""}`
      : "—",
    location: l.location,
    lot: l.lot?.number ?? "—",
    quantity: l.quantity,
  }));

  async function saveMeta(formData: FormData) {
    "use server";
    await saveDocumentFromForm("outbound", formData, id);
  }

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <Link href={docListPath("outbound")} className={buttonSecondaryClass}>
            {ts("toList")}
          </Link>
        }
      />

      <Panel title={ts("details")}>
        <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <MetaRecordFields
            entityCode="outbound"
            sections={detailSections}
            values={formValues.values}
            context={{
              counterparties: customers.map((c) => ({ id: c.id, label: c.name })),
              docks: docks.map((dock) => ({
                id: dock.id,
                label: formatReceivingDockLabel(dock),
                disabled:
                  dock.status === "BUSY" && dock.id !== doc.receivingDockId,
              })),
              transportUnits: transportUnits.map((unit) => ({
                id: unit.id,
                label: formatTransportUnitLabel(unit),
              })),
              extraRefOptions,
            }}
            disabled={cancelled || posted}
            formId={`outbound-meta-${id}`}
            onSave={saveMeta}
          />
          <DocumentStatusControl
            entityCode="outbound"
            documentId={id}
            status={doc.status}
            transitions={statusTransitions}
          />
        </dl>
      </Panel>

      {extraAttrs.length > 0 ? (
        <Panel title={ts("extraDetails")}>
          <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <MetaRecordFields
              entityCode="outbound"
              sections={[
                { code: "extra", name: ts("extraShort"), attributes: extraAttrs },
              ]}
              values={formValues.values}
              context={{ extraRefOptions }}
              disabled={cancelled || posted}
              formId={`outbound-extra-${id}`}
              onSave={saveMeta}
            />
          </dl>
        </Panel>
      ) : null}

      <OutboundStatusHistoryPanel entries={historyViews} />

      <Panel flush title={ts("goods")}>
        {draft ? (
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <Link
              href={docLineNewPath("outbound", id)}
              className={buttonSecondaryClass}
            >
              {ts("addLine")}
            </Link>
          </div>
        ) : null}
        {lineDef ? (
          <MetaDocumentLinesTable
            columns={lineDef.columns.filter(
              (c) => (!lotsEnabled ? c.code !== "lot" : true),
            )}
            rows={lineRows}
            title=""
            empty={ts("noRows")}
          />
        ) : null}
      </Panel>
    </Page>
  );
}
