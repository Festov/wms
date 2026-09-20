import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { parseInboundKind } from "@/lib/inbound-document";
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

async function resolveSupplier(customerId: string | null) {
  if (!customerId) return null;
  const row = await prisma.counterparty.findFirst({
    where: {
      id: customerId,
      isActive: true,
      OR: [{ kind: "SUPPLIER" }, { kind: "BOTH" }],
    },
  });
  if (!row) return throwLocalized("errors.documents.supplierNotFound");
  return row.name;
}

async function systemAttrs() {
  const entity = await getMetaEntity("inbound");
  if (!entity) return [];
  return entity.attributes.filter(
    (a) => a.formVisible && a.systemField && a.isSystem,
  );
}

export async function updateInboundDocumentFromForm(
  documentId: string,
  formData: FormData,
) {
  await requireModule("inbound");

  const doc = await prisma.inboundDocument.findUniqueOrThrow({
    where: { id: documentId },
  });
  if (doc.status === "CANCELLED") {
    return throwLocalized("errors.documents.cancelledCannotEdit");
  }

  const attrs = await systemAttrs();
  await validateDocumentForm(attrs, formData);

  const supplierId = str(formData, "supplierId");
  const supplier = supplierId ? await resolveSupplier(supplierId) : doc.supplier;
  if (attrs.some((a) => a.code === "supplier" && a.required) && !supplier) {
    return throwLocalized("errors.documents.selectSupplier");
  }

  const receivingDockId = strField(formData, "receivingDockId");
  const prevDockId = doc.receivingDockId;
  if (receivingDockId) {
    await assertReceivingDockAssignable(receivingDockId, documentId, "inbound");
  }

  await prisma.inboundDocument.update({
    where: { id: documentId },
    data: {
      supplier,
      expectedDate:
        parseOptionalDate(formData.get("expectedDate")) ?? doc.expectedDate,
      kind: parseInboundKind(str(formData, "kind") || doc.kind),
      purchaseOrderRef: strField(formData, "purchaseOrderRef"),
      waybillRef: strField(formData, "waybillRef"),
      externalRef: strField(formData, "externalRef"),
      actualArrivalAt: parseOptionalDate(formData.get("actualArrivalAt")),
      receivingDockId,
      transportUnitId: strField(formData, "transportUnitId"),
      notes: strField(formData, "notes"),
    },
  });

  await saveDocumentExtraFromForm("inbound", documentId, formData, doc.number);
  await syncReceivingDockStatus(prevDockId);
  await syncReceivingDockStatus(receivingDockId);

  revalidatePath("/doc/inbound");
  revalidatePath(`/doc/inbound/${documentId}`);
  revalidatePath("/inbound");
  revalidatePath(`/inbound/${documentId}`);
  revalidatePath("/catalog/receiving_docks");
}
