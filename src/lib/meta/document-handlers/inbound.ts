import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { updateInboundDocumentFromForm } from "@/lib/meta/document-handlers/inbound-save";
import { throwLocalized } from "@/lib/i18n/errors-server";
import type { DocumentHandler } from "@/lib/meta/document-handlers/types";
import { requireModule } from "@/lib/session";

export const inboundDocumentHandler: DocumentHandler = {
  entityCode: "inbound",
  handler: "inbound",
  capabilities: ["lines", "workflow", "stock", "tsd"],
  async list(filters) {
    await requireModule("inbound");
    const where: Prisma.InboundDocumentWhereInput = {};
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.kind?.length) where.kind = { in: filters.kind as Prisma.EnumInboundKindFilter["in"] };
    if (filters.q) {
      const q = filters.q;
      where.OR = [
        { number: { contains: q } },
        { supplier: { contains: q } },
        { purchaseOrderRef: { contains: q } },
        { waybillRef: { contains: q } },
        { externalRef: { contains: q } },
        { notes: { contains: q } },
      ];
    }
    return prisma.inboundDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        receivingDock: { include: { zone: true } },
        transportUnit: true,
        _count: { select: { lines: { where: { locationId: null } } } },
      },
    });
  },
  async get(id) {
    await requireModule("inbound");
    return prisma.inboundDocument.findUnique({
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
    });
  },
  async create() {
    return throwLocalized("errors.documents.useCreateInbound");
  },
  async update(id, formData) {
    await updateInboundDocumentFromForm(id, formData);
  },
};
