import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader, buttonSecondaryClass } from "@/components/ui";
import { InboundCreateForm } from "@/components/inbound-create-form";
import { OutboundCreateForm } from "@/components/outbound-create-form";
import {
  MetaRecordFields,
  buildMetaRecordSections,
} from "@/components/meta-record-fields";
import { createDocumentRecord } from "@/lib/meta/actions";
import { getMetaEntity, listRefOptions } from "@/lib/meta/catalog";
import { isSystemDocumentEntity } from "@/lib/meta/document-registry";
import { docListPath } from "@/lib/meta/document-paths";
import {
  getDocumentFormAttributes,
  loadDocumentExtraRefOptions,
} from "@/lib/meta/document-form";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { formatReceivingDockLabel } from "@/lib/receiving-dock";
import { formatTransportUnitLabel } from "@/lib/transport-unit";
import { requireModule, isModuleFlagEnabled } from "@/lib/session";
import { buttonClass } from "@/components/ui";

export default async function DocumentNewPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity: entityCode } = await params;
  const tc = await getTranslations("pages.common");
  const td = await getTranslations("pages.doc");

  if (entityCode === "inbound") {
    await requireModule("inbound");
    const lotsEnabled = await isModuleFlagEnabled("lots");
    const [
      { sections: metaSections },
      suppliers,
      products,
      packages,
      lots,
      docks,
      transportUnits,
    ] = await Promise.all([
      getDocumentFormAttributes("inbound"),
      prisma.counterparty.findMany({
        where: {
          isActive: true,
          OR: [{ kind: "SUPPLIER" }, { kind: "BOTH" }],
        },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { sku: "asc" },
      }),
      prisma.package.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: { unit: true },
      }),
      lotsEnabled
        ? prisma.lot.findMany({
            orderBy: { number: "asc" },
            include: { product: true },
            take: 1000,
          })
        : Promise.resolve([]),
      prisma.receivingDock.findMany({
        where: { isActive: true },
        orderBy: [{ status: "asc" }, { code: "asc" }],
        include: { zone: true },
      }),
      prisma.transportUnit.findMany({
        where: { isActive: true },
        orderBy: { plateNumber: "asc" },
      }),
    ]);
    const extraRefOptions = await loadDocumentExtraRefOptions("inbound");
    return (
      <Page>
        <PageHeader
          title={td("newInbound")}
          actions={
            <Link href={docListPath("inbound")} className={buttonSecondaryClass}>
              {tc("toList")}
            </Link>
          }
        />
        <InboundCreateForm
          lotsEnabled={lotsEnabled}
          metaSections={metaSections}
          fieldContext={{
            counterparties: suppliers.map((s) => ({ id: s.id, label: s.name })),
            docks: docks.map((dock) => ({
              id: dock.id,
              label: formatReceivingDockLabel(dock),
              disabled: dock.status === "BUSY",
            })),
            transportUnits: transportUnits.map((unit) => ({
              id: unit.id,
              label: formatTransportUnitLabel(unit),
            })),
            extraRefOptions,
          }}
          products={products.map((p) => ({
            id: p.id,
            label: `${p.sku} · ${p.name}`,
          }))}
          packages={packages.map((p) => ({
            id: p.id,
            productId: p.productId,
            factor: p.factor,
            label: p.name,
          }))}
          lots={lots.map((l) => ({
            id: l.id,
            productId: l.productId,
            label: l.expiryDate
              ? `${l.number} · до ${formatDate(l.expiryDate).slice(0, 10)}`
              : l.number,
          }))}
        />
      </Page>
    );
  }

  if (entityCode === "outbound") {
    await requireModule("outbound");
    const lotsEnabled = await isModuleFlagEnabled("lots");
    const [
      { sections: metaSections },
      customers,
      products,
      packages,
      locations,
      lots,
      docks,
      transportUnits,
    ] = await Promise.all([
      getDocumentFormAttributes("outbound"),
      prisma.counterparty.findMany({
        where: {
          isActive: true,
          OR: [{ kind: "CUSTOMER" }, { kind: "BOTH" }],
        },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { sku: "asc" },
      }),
      prisma.package.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: { unit: true },
      }),
      prisma.location.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
      lotsEnabled
        ? prisma.lot.findMany({ orderBy: { number: "asc" }, take: 1000 })
        : Promise.resolve([]),
      prisma.receivingDock.findMany({
        where: { isActive: true },
        orderBy: [{ status: "asc" }, { code: "asc" }],
        include: { zone: true },
      }),
      prisma.transportUnit.findMany({
        where: { isActive: true },
        orderBy: { plateNumber: "asc" },
      }),
    ]);
    const extraRefOptions = await loadDocumentExtraRefOptions("outbound");
    return (
      <Page>
        <PageHeader
          title={td("newOutbound")}
          actions={
            <Link href={docListPath("outbound")} className={buttonSecondaryClass}>
              {tc("toList")}
            </Link>
          }
        />
        <OutboundCreateForm
          lotsEnabled={lotsEnabled}
          metaSections={metaSections}
          fieldContext={{
            counterparties: customers.map((c) => ({ id: c.id, label: c.name })),
            docks: docks.map((dock) => ({
              id: dock.id,
              label: formatReceivingDockLabel(dock),
              disabled: dock.status === "BUSY",
            })),
            transportUnits: transportUnits.map((unit) => ({
              id: unit.id,
              label: formatTransportUnitLabel(unit),
            })),
            extraRefOptions,
          }}
          products={products.map((p) => ({
            id: p.id,
            label: `${p.sku} · ${p.name}`,
          }))}
          packages={packages.map((p) => ({
            id: p.id,
            productId: p.productId,
            factor: p.factor,
            label: p.name,
          }))}
          locations={locations.map((l) => ({
            id: l.id,
            label: l.code,
          }))}
          lots={lots.map((l) => ({
            id: l.id,
            productId: l.productId,
            label: l.number,
          }))}
        />
      </Page>
    );
  }

  if (entityCode === "operation" || isSystemDocumentEntity(entityCode)) {
    notFound();
  }

  const entity = await getMetaEntity(entityCode);
  if (!entity || entity.kind !== "document" || entity.storage !== "custom") {
    notFound();
  }

  const refOptions: Record<string, { id: string; label: string }[]> = {};
  for (const attr of entity.attributes) {
    if (attr.type === "ref" && attr.refEntityCode) {
      refOptions[attr.code] = await listRefOptions(attr.refEntityCode);
    }
  }

  const recordSections = buildMetaRecordSections(entity, entity.sections);
  const today = new Date().toISOString().slice(0, 10);

  async function action(formData: FormData) {
    "use server";
    await createDocumentRecord(entityCode, formData);
  }

  return (
    <Page key={entityCode}>
      <PageHeader
        title={tc("newTitle", { name: entity.name })}
        actions={
          <Link href={docListPath(entityCode)} className={buttonSecondaryClass}>
            {tc("back")}
          </Link>
        }
      />

      <form action={action} className="space-y-4">
        <MetaRecordFields
          sections={recordSections}
          refOptions={refOptions}
          values={{ date: today }}
          layout="panels"
        />
        <button className={buttonClass} type="submit">
          {tc("create")}
        </button>
      </form>
    </Page>
  );
}
