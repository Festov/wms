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
import { DocumentStatusControl } from "@/components/document-status-control";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { operationTypeLabel } from "@/lib/operation-document";
import { documentStatusTransitionsForUi } from "@/lib/document-status-ui";
import { docDetailPath, docListPath } from "@/lib/meta/document-paths";
import { loadLineDefinition } from "@/lib/meta/lines";
import { requireModule } from "@/lib/session";

export async function OperationDetailView({ id }: { id: string }) {
  await requireModule("operations");
  const ts = await getTranslations("components.shared");
  const [doc, lineDef] = await Promise.all([
    prisma.operationDocument.findUnique({
      where: { id },
      include: {
        createdBy: true,
        inboundDocument: { select: { id: true, number: true } },
        pallet: { select: { code: true } },
        fromLocation: { select: { code: true, name: true } },
        toLocation: { select: { code: true, name: true } },
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            product: true,
            package: true,
            lot: true,
            pallet: true,
            fromLocation: true,
            toLocation: true,
          },
        },
      },
    }),
    loadLineDefinition("operation"),
  ]);

  if (!doc) notFound();

  const statusTransitions = await documentStatusTransitionsForUi(
    "operation",
    id,
    doc.status,
    doc.lines.length,
  );

  const who = doc.createdBy
    ? doc.createdBy.name ||
      (doc.createdBy.email.includes("@")
        ? doc.createdBy.email.split("@")[0]
        : doc.createdBy.email)
    : "—";

  const lineRows = doc.lines.map((l) => ({
    id: l.id,
    lineNo: l.lineNo,
    product: l.product,
    package: l.package
      ? `${l.package.name}${l.packageQty != null ? ` · ${l.packageQty}` : ""}`
      : "—",
    lot: l.lot,
    pallet: l.pallet,
    fromLocation: l.fromLocation,
    toLocation: l.toLocation,
    quantity: l.quantity,
  }));

  return (
    <Page>
      <PageHeader
        title={doc.number}
        description={operationTypeLabel(doc.type)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={docListPath("operation")} className={buttonSecondaryClass}>
              {ts("toList")}
            </Link>
            {doc.inboundDocument ? (
              <Link
                href={docDetailPath("inbound", doc.inboundDocument.id)}
                className={buttonSecondaryClass}
              >
                {ts("toOrder", { number: doc.inboundDocument.number })}
              </Link>
            ) : null}
          </div>
        }
      />

      <Panel title={ts("details")}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--muted)]">{ts("type")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {operationTypeLabel(doc.type)}
            </dd>
          </div>
          <div>
            <DocumentStatusControl
              entityCode="operation"
              documentId={id}
              status={doc.status}
              transitions={statusTransitions}
            />
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{ts("who")}</dt>
            <dd className="mt-1 text-sm font-medium">{who}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{ts("when")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {formatDate(doc.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{ts("inboundOrder")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {doc.inboundDocument ? (
                <Link
                  href={docDetailPath("inbound", doc.inboundDocument.id)}
                  className="text-[var(--accent)] hover:underline"
                >
                  {doc.inboundDocument.number}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{ts("pallet")}</dt>
            <dd className="mt-1 text-sm font-medium">{doc.pallet?.code ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">{ts("route")}</dt>
            <dd className="mt-1 text-sm font-medium">
              {ts("fromTo", {
                from: doc.fromLocation?.code ?? "—",
                to: doc.toLocation?.code ?? "—",
              })}
            </dd>
          </div>
          {doc.notes ? (
            <div className="sm:col-span-3">
              <dt className="text-xs text-[var(--muted)]">{ts("notes")}</dt>
              <dd className="mt-1 text-sm font-medium">{doc.notes}</dd>
            </div>
          ) : null}
        </dl>
      </Panel>

      {lineDef ? (
        <MetaDocumentLinesTable
          columns={lineDef.columns}
          rows={lineRows}
          title={ts("lines")}
        />
      ) : (
        <Panel flush title={ts("lines")}>
          <DataTable headers={[ts("rowNo")]} empty={ts("noRows")}>
            {null}
          </DataTable>
        </Panel>
      )}
    </Page>
  );
}
