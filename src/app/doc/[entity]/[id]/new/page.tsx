import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Page, PageHeader, buttonSecondaryClass } from "@/components/ui";
import { InboundAddLineForm } from "@/components/inbound-add-line-form";
import { OutboundAddLineForm } from "@/components/outbound-add-line-form";
import { CustomDocumentAddLineForm } from "@/components/custom-document-add-line-form";
import { addInboundLine, addOutboundLine } from "@/lib/module-actions";
import { addCustomDocumentLineAction } from "@/lib/meta/actions";
import { getCatalogRow } from "@/lib/meta/catalog";
import { loadCustomDocumentLines } from "@/lib/meta/custom-lines";
import { hasCapability } from "@/lib/meta/document-registry";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { docDetailPath } from "@/lib/meta/document-paths";
import { requireModule, isModuleFlagEnabled } from "@/lib/session";

export default async function DocumentLineNewPage({
  params,
}: {
  params: Promise<{ entity: string; id: string }>;
}) {
  const { entity, id } = await params;
  const tc = await getTranslations("pages.common");

  if (entity === "inbound") {
    await requireModule("inbound");
    const lotsEnabled = await isModuleFlagEnabled("lots");
    const doc = await prisma.inboundDocument.findUnique({ where: { id } });
    if (!doc) notFound();
    if (doc.status !== "DRAFT") redirect(docDetailPath("inbound", id));

    const [products, packages, lots] = await Promise.all([
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
        ? prisma.lot.findMany({ orderBy: { number: "asc" }, take: 1000 })
        : Promise.resolve([]),
    ]);

    async function action(formData: FormData) {
      "use server";
      await addInboundLine(id, formData);
    }

    return (
      <Page>
        <PageHeader
          title={tc("lineTitle", { title: doc.number })}
          actions={
            <Link
              href={docDetailPath("inbound", id)}
              className={buttonSecondaryClass}
            >
              {tc("toDocument")}
            </Link>
          }
        />
        <InboundAddLineForm
          action={action}
          lotsEnabled={lotsEnabled}
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

  if (entity === "outbound") {
    await requireModule("outbound");
    const lotsEnabled = await isModuleFlagEnabled("lots");
    const doc = await prisma.outboundDocument.findUnique({ where: { id } });
    if (!doc) notFound();
    if (doc.status !== "DRAFT") redirect(docDetailPath("outbound", id));

    const [products, packages, locations, lots] = await Promise.all([
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
    ]);

    async function action(formData: FormData) {
      "use server";
      await addOutboundLine(id, formData);
    }

    return (
      <Page>
        <PageHeader
          title={tc("lineTitle", { title: doc.number })}
          actions={
            <Link
              href={docDetailPath("outbound", id)}
              className={buttonSecondaryClass}
            >
              {tc("toDocument")}
            </Link>
          }
        />
        <OutboundAddLineForm
          action={action}
          lotsEnabled={lotsEnabled}
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

  const { entity: customEntity, row } = await getCatalogRow(entity, id);
  if (
    customEntity &&
    row &&
    customEntity.kind === "document" &&
    customEntity.storage === "custom" &&
    hasCapability(customEntity, "lines")
  ) {
    const { lineDef, refOptions } = await loadCustomDocumentLines(id, entity);
    if (!lineDef) notFound();

    async function action(formData: FormData) {
      "use server";
      await addCustomDocumentLineAction(entity, id, formData);
    }

    const title = String(row.number ?? row.title ?? customEntity.name);

    return (
      <Page>
        <PageHeader
          title={tc("lineTitle", { title })}
          actions={
            <Link
              href={docDetailPath(entity, id)}
              className={buttonSecondaryClass}
            >
              {tc("toDocument")}
            </Link>
          }
        />
        <CustomDocumentAddLineForm
          action={action}
          columns={lineDef.columns}
          refOptions={refOptions}
        />
      </Page>
    );
  }

  notFound();
}
