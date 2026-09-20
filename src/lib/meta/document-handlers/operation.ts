import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import type { DocumentHandler } from "@/lib/meta/document-handlers/types";
import { requireModule } from "@/lib/session";
import type { OperationDocType } from "@/generated/prisma/client";

function isOperationType(value: string): value is OperationDocType {
  return ["RECEIVE_REPORT", "PUTAWAY", "TRANSFER", "PICK"].includes(value);
}

export const operationDocumentHandler: DocumentHandler = {
  entityCode: "operation",
  handler: "operation",
  capabilities: ["lines", "workflow"],
  async list(filters) {
    await requireModule("operations");
    const where: Prisma.OperationDocumentWhereInput = {
      ...(filters.type && isOperationType(filters.type)
        ? { type: filters.type }
        : {}),
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters.q
        ? {
            OR: [
              { number: { contains: filters.q } },
              { notes: { contains: filters.q } },
              { pallet: { code: { contains: filters.q } } },
              { inboundDocument: { number: { contains: filters.q } } },
            ],
          }
        : {}),
    };
    return prisma.operationDocument.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 300,
      include: {
        createdBy: { select: { name: true, email: true } },
        inboundDocument: { select: { id: true, number: true } },
        pallet: { select: { code: true } },
        fromLocation: { select: { code: true } },
        toLocation: { select: { code: true } },
        _count: { select: { lines: true } },
      },
    });
  },
  async get(id) {
    await requireModule("operations");
    return prisma.operationDocument.findUnique({
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
    });
  },
  async update() {
    return throwLocalized("errors.documents.operationsReadOnly");
  },
};
