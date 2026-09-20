import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonSecondaryClass,
} from "@/components/ui";
import { MetaDocumentLinesTable } from "@/components/meta-document-lines";
import { InboundReceiveFactButton } from "@/components/inbound-receive-fact-panel";
import { InboundStatusHistoryPanel } from "@/components/inbound-status-history-panel";
import { DocumentStatusControl } from "@/components/document-status-control";
import {
  MetaRecordFields,
} from "@/components/meta-record-fields";
import { documentStatusTransitionsForUi } from "@/lib/document-status-ui";
import { formatReceivingDockLabel } from "@/lib/receiving-dock";
import { formatTransportUnitLabel } from "@/lib/transport-unit";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { operationTypeLabel } from "@/lib/operation-document";
import {
  docDetailPath,
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

export async function InboundDetailView({ id }: { id: string }) {
  await requireModule("inbound");
  const t = await getTranslations("components.docHandlers.inbound");
  const ts = await getTranslations("components.shared");
  const lotsEnabled = await isModuleFlagEnabled("lots");

  const [
    { sections: formSections },
    formValues,
    doc,
    suppliers,
    operationDocs,
    statusHistory,
    docks,
    transportUnits,
    lineDef,
  ] = await Promise.all([
    getDocumentFormAttributes("inbound"),
    loadDocumentFormValues("inbound", id),
    prisma.inboundDocument.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            product: true,
            lot: true,
            location: true,
            package: { include: { unit: true } },
            pallet: true,
          },
        },
      },
    }),
    prisma.counterparty.findMany({
      where: {
        isActive: true,
        OR: [{ kind: "SUPPLIER" }, { kind: "BOTH" }],
      },
      orderBy: { name: "asc" },
    }),
    prisma.operationDocument.findMany({
      where: { inboundDocumentId: id },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        pallet: { select: { code: true } },
        toLocation: { select: { code: true } },
        fromLocation: { select: { code: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.inboundStatusHistory.findMany({
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
    loadLineDefinition("inbound"),
  ]);

  if (!doc) notFound();

  const extraRefOptions = await loadDocumentExtraRefOptions("inbound");
  const detailSections = mergeDetailSections(formSections);
  const extraAttrs = extraSectionAttributes(formSections);
  const cancelled = doc.status === "CANCELLED";
  const draft = doc.status === "DRAFT";
  const plannedLines = doc.lines.filter((l) => l.locationId == null);
  const factLines = doc.lines.filter((l) => l.locationId != null);
  const displayStatus = doc.status === "COMPLETED" ? "PLACED" : doc.status;
  const statusTransitions = await documentStatusTransitionsForUi(
    "inbound",
    id,
    displayStatus,
    plannedLines.length + factLines.length,
  );

  const factLineViews = factLines.map((line, index) => ({
    id: line.id,
    index: index + 1,
    productSku: line.product.sku,
    productName: line.product.name,
    packageLabel: line.package
      ? `${line.package.name}${line.packageQty != null ? ` · ${line.packageQty}` : ""}`
      : "—",
    lotLabel: line.lot?.number ?? line.lotNumber ?? "—",
    palletCode: line.pallet?.code ?? "—",
    locationCode: line.location?.code ?? "—",
    quantity: line.quantity,
  }));

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

  const lineRows = plannedLines.map((l) => ({
    id: l.id,
    lineNo: l.lineNo,
    product: l.product,
    package: l.package
      ? `${l.package.name}${l.packageQty != null ? ` · ${l.packageQty}` : ""}`
      : "—",
    lot: l.lot?.number ?? l.lotNumber ?? "—",
    quantity: l.quantity,
  }));

  async function saveMeta(formData: FormData) {
    "use server";
    await saveDocumentFromForm("inbound", formData, id);
  }

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InboundReceiveFactButton
              lines={factLineViews}
              plannedQty={plannedLines.reduce((s, l) => s + l.quantity, 0)}
              receivedQty={factLines.reduce((s, l) => s + l.quantity, 0)}
              palletCount={
                new Set(factLines.map((l) => l.palletId).filter(Boolean)).size
              }
              postedAtLabel={doc.postedAt ? formatDate(doc.postedAt) : null}
              lotsEnabled={lotsEnabled}
            />
            <Link href={docListPath("inbound")} className={buttonSecondaryClass}>
              {ts("toList")}
            </Link>
          </div>
        }
      />

      <Panel title={ts("details")}>
        <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <MetaRecordFields
            entityCode="inbound"
            sections={detailSections}
            values={formValues.values}
            context={{
              counterparties: suppliers.map((s) => ({ id: s.id, label: s.name })),
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
            disabled={cancelled}
            formId={`inbound-meta-${id}`}
            onSave={saveMeta}
          />
          <DocumentStatusControl
            entityCode="inbound"
            documentId={id}
            status={displayStatus}
            transitions={statusTransitions}
          />
        </dl>
      </Panel>

      {extraAttrs.length > 0 ? (
        <Panel title={ts("extraDetails")}>
          <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <MetaRecordFields
              entityCode="inbound"
              sections={[
                { code: "extra", name: ts("extraShort"), attributes: extraAttrs },
              ]}
              values={formValues.values}
              context={{ extraRefOptions }}
              disabled={cancelled}
              formId={`inbound-extra-${id}`}
              onSave={saveMeta}
            />
          </dl>
        </Panel>
      ) : null}

      <InboundStatusHistoryPanel entries={historyViews} />

      <Panel flush title={ts("goods")}>
        {draft ? (
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <Link
              href={docLineNewPath("inbound", id)}
              className={buttonSecondaryClass}
            >
              {ts("addLine")}
            </Link>
          </div>
        ) : null}
        {lineDef ? (
          <MetaDocumentLinesTable
            columns={lineDef.columns.filter(
              (c) => !lotsEnabled ? c.code !== "lot" : true,
            )}
            rows={lineRows}
            title=""
            empty={ts("noRows")}
          />
        ) : null}
      </Panel>

      {operationDocs.length > 0 ? (
        <Panel flush title={ts("operationDocs")}>
          <DataTable
            headers={[
              ts("number"),
              ts("type"),
              ts("status"),
              ts("pallet"),
              ts("destination"),
              ts("who"),
              ts("when"),
              ts("lines"),
            ]}
          >
            {operationDocs.map((op) => {
              const who = op.createdBy
                ? op.createdBy.name ||
                  (op.createdBy.email.includes("@")
                    ? op.createdBy.email.split("@")[0]
                    : op.createdBy.email)
                : "—";
              return (
                <tr key={op.id} className="hover:bg-[var(--surface)]/60">
                  <td className="px-3 py-2">
                    <Link
                      href={docDetailPath("operation", op.id)}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {op.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{operationTypeLabel(op.type)}</td>
                  <td className="px-3 py-2">{op.status}</td>
                  <td className="px-3 py-2">{op.pallet?.code ?? "—"}</td>
                  <td className="px-3 py-2">
                    {op.toLocation?.code ?? op.fromLocation?.code ?? "—"}
                  </td>
                  <td className="px-3 py-2">{who}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {formatDate(op.createdAt)}
                  </td>
                  <td className="px-3 py-2">{op._count.lines}</td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>
      ) : null}
    </Page>
  );
}
