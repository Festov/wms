import { NextRequest } from "next/server";
import { requireTsdAuth, requireTsdPermission, jsonOk } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";

/** ТН со статусом ACCEPTED — очередь на размещение. */
export async function GET(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.putaway");
  if (denied) return denied;

  const pallets = await prisma.pallet.findMany({
    where: {
      isActive: true,
      status: "ACCEPTED",
      balances: { some: { quantity: { gt: 0 } } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      location: true,
      balances: {
        where: { quantity: { gt: 0 } },
        include: { product: true },
      },
    },
  });

  return jsonOk(
    pallets.map((p) => ({
      id: p.id,
      code: p.code,
      barcode: p.barcode,
      status: p.status,
      location: p.location
        ? { id: p.location.id, code: p.location.code, name: p.location.name }
        : null,
      lines: p.balances.map((b) => ({
        productId: b.productId,
        sku: b.product.sku,
        name: b.product.name,
        quantity: b.quantity,
      })),
    })),
  );
}
