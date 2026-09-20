import { NextRequest } from "next/server";
import { requireTsdAuth, requireTsdPermission, jsonOk } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { docDetailPath } from "@/lib/meta/document-paths";
import { listTsdOpenStatuses } from "@/lib/workflow/tsd";

function withWebPath<T extends { id: string }>(entityCode: string, doc: T) {
  return {
    ...doc,
    webPath: docDetailPath(entityCode, doc.id),
  };
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;

  const type = request.nextUrl.searchParams.get("type"); // inbound | outbound
  if (type === "outbound") {
    const denied = await requireTsdPermission("tsd.pick");
    if (denied) return denied;
    const openStatuses = await listTsdOpenStatuses("outbound");
    const docs = await prisma.outboundDocument.findMany({
      where: { status: { in: openStatuses } },
      orderBy: { createdAt: "desc" },
      include: { lines: { include: { product: true, location: true, lot: true } } },
    });
    return jsonOk(docs.map((doc) => withWebPath("outbound", doc)));
  }

  const denied = await requireTsdPermission("tsd.receive");
  if (denied) return denied;

  const openStatuses = await listTsdOpenStatuses("inbound");
  const docs = await prisma.inboundDocument.findMany({
    where: { status: { in: openStatuses } },
    orderBy: { createdAt: "desc" },
    include: {
      lines: {
        where: { locationId: null },
        orderBy: { lineNo: "asc" },
        include: {
          product: {
            include: {
              accountingModel: true,
              unit: true,
              packages: {
                where: { isActive: true },
                include: { unit: true },
                orderBy: { factor: "asc" },
              },
            },
          },
          lot: true,
          package: { include: { unit: true } },
        },
      },
    },
  });
  return jsonOk(docs.map((doc) => withWebPath("inbound", doc)));
}
