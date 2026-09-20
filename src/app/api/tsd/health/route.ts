import { NextRequest } from "next/server";
import { requireTsdAuth, jsonOk } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const [products, locations, openInbound, openOutbound] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.location.count({ where: { isActive: true } }),
    prisma.inboundDocument.count({ where: { status: "RELEASED" } }),
    prisma.outboundDocument.count({ where: { status: "RELEASED" } }),
  ]);

  return jsonOk({
    ok: true,
    warehouse: settings?.warehouseCode ?? "WH",
    products,
    locations,
    openInbound,
    openOutbound,
  });
}
