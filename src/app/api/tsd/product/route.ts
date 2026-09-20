import { NextRequest } from "next/server";
import {
  requireTsdAuth,
  requireTsdReadAccess,
  jsonOk,
  jsonError,
  jsonApiError,
} from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdReadAccess();
  if (denied) return denied;

  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();
  const sku = request.nextUrl.searchParams.get("sku")?.trim();
  if (!barcode && !sku) return jsonApiError("barcodeOrSkuRequired");

  // Сначала ищем упаковку по её штрихкоду (коробка ×10 ≠ единица ×1).
  const matchedPackage = barcode
    ? await prisma.package.findFirst({
        where: { barcode, isActive: true },
        include: {
          unit: true,
          product: {
            include: {
              unit: true,
              packages: { where: { isActive: true }, include: { unit: true } },
              balances: {
                where: { quantity: { gt: 0 } },
                include: { location: true, lot: true, package: true },
              },
            },
          },
        },
      })
    : null;

  if (matchedPackage?.product?.isActive) {
    return jsonOk({
      ...matchedPackage.product,
      matchedPackage: {
        id: matchedPackage.id,
        name: matchedPackage.name,
        factor: matchedPackage.factor,
        barcode: matchedPackage.barcode,
        unit: matchedPackage.unit,
      },
    });
  }

  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: [
        barcode ? { barcode } : undefined,
        sku ? { sku } : undefined,
      ].filter(Boolean) as Array<{ barcode: string } | { sku: string }>,
    },
    include: {
      unit: true,
      packages: { where: { isActive: true }, include: { unit: true } },
      balances: {
        where: { quantity: { gt: 0 } },
        include: { location: true, lot: true, package: true },
      },
    },
  });

  if (!product) return jsonError("Товар не найден", 404);
  return jsonOk({ ...product, matchedPackage: null });
}
