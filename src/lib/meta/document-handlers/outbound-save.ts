import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { parseOutboundKind } from "@/lib/outbound-document";
import {
  assertReceivingDockAssignable,
  syncReceivingDockStatus,
} from "@/lib/receiving-dock";
import { validateDocumentForm } from "@/lib/meta/document-form-validate";
import { getMetaEntity } from "@/lib/meta/catalog";
import { saveDocumentExtraFromForm } from "@/lib/meta/document-form";
import { requireModule } from "@/lib/session";
import { parseOptionalDate } from "@/lib/stock";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function strField(formData: FormData, key: string) {
  const v = str(formData, key);
  return v || null;
}

async function resolveCustomer(customerId: string | null) {
  if (!customerId) return null;
  const row = await prisma.counterparty.findFirst({
    where: {
      id: customerId,
      isActive: true,
      OR: [{ kind: "CUSTOMER" }, { kind: "BOTH" }],
    },
  });
  if (!row) return throwLocalized("errors.documents.customerNotFound");
  return row.name;
}

async function systemAttrs() {
  const entity = await getMetaEntity("outbound");
  if (!entity) return [];
  return entity.attributes.filter(
    (a) => a.formVisible && a.systemField && a.isSystem,
  );
}

export async function updateOutboundDocumentFromForm(
  documentId: string,
  formData: FormData,
) {
  await requireModule("outbound");

  const doc = await prisma.outboundDocument.findUniqueOrThrow({
    where: { id: documentId },
  });
  if (doc.status === "CANCELLED" || doc.status === "POSTED") {
    return throwLocalized("errors.documents.cannotEditInStatus");
  }

  const attrs = await systemAttrs();
  await validateDocumentForm(attrs, formData);

  const customerId = str(formData, "customerId");
  const customer = customerId
    ? await resolveCustomer(customerId)
    : doc.customer;

  const receivingDockId = strField(formData, "receivingDockId");
  const prevDockId = doc.receivingDockId;
  if (receivingDockId) {
    await assertReceivingDockAssignable(receivingDockId, documentId, "outbound");
  }

  await prisma.outboundDocument.update({
    where: { id: documentId },
    data: {
      customer,
      shipDate: parseOptionalDate(formData.get("shipDate")),
      kind: parseOutboundKind(str(formData, "kind") || doc.kind),
      salesOrderRef: strField(formData, "salesOrderRef"),
      waybillRef: strField(formData, "waybillRef"),
      externalRef: strField(formData, "externalRef"),
      actualShipmentAt: parseOptionalDate(formData.get("actualShipmentAt")),
      receivingDockId,
      transportUnitId: strField(formData, "transportUnitId"),
      notes: strField(formData, "notes"),
    },
  });

  await saveDocumentExtraFromForm("outbound", documentId, formData, doc.number);
  await syncReceivingDockStatus(prevDockId);
  await syncReceivingDockStatus(receivingDockId);

  revalidatePath("/doc/outbound");
  revalidatePath(`/doc/outbound/${documentId}`);
  revalidatePath("/outbound");
  revalidatePath(`/outbound/${documentId}`);
  revalidatePath("/catalog/receiving_docks");
}
