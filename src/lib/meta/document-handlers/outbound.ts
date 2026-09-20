import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { updateOutboundDocumentFromForm } from "@/lib/meta/document-handlers/outbound-save";
import { throwLocalized } from "@/lib/i18n/errors-server";
import type { DocumentHandler } from "@/lib/meta/document-handlers/types";
import { requireModule } from "@/lib/session";

export const outboundDocumentHandler: DocumentHandler = {
  entityCode: "outbound",
  handler: "outbound",
  capabilities: ["lines", "workflow", "stock", "tsd"],
  async list(filters) {
    await requireModule("outbound");
    const where: Prisma.OutboundDocumentWhereInput = {};
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.kind?.length) where.kind = { in: filters.kind as Prisma.EnumOutboundKindFilter["in"] };
    if (filters.q) {
      const q = filters.q;
      where.OR = [
        { number: { contains: q } },
        { customer: { contains: q } },
        { salesOrderRef: { contains: q } },
        { waybillRef: { contains: q } },
        { externalRef: { contains: q } },
        { notes: { contains: q } },
      ];
    }
    return prisma.outboundDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        receivingDock: { include: { zone: true } },
        transportUnit: true,
        _count: { select: { lines: true } },
      },
    });
  },
  async get(id) {
    await requireModule("outbound");
    return prisma.outboundDocument.findUnique({
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
    });
  },
  async create() {
    return throwLocalized("errors.documents.useCreateOutbound");
  },
  async update(id, formData) {
    await updateOutboundDocumentFromForm(id, formData);
  },
};
