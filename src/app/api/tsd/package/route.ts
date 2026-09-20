import { NextRequest } from "next/server";
import {
  requireTsdAuth,
  requireTsdPermission,
  jsonOk,
  jsonApiError,
} from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { findOrCreatePackage } from "@/lib/meta/catalog";

/** Создать упаковку номенклатуры с ТСД (коэффициент + единица). */
export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.receive");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId || "").trim();
  const unitId = String(body.unitId || "").trim();
  const factor = Number(body.factor);
  const barcode = String(body.barcode || "").trim() || null;

  if (!productId) return jsonApiError("productIdRequired");
  if (!unitId) return jsonApiError("unitIdRequired");
  if (!Number.isFinite(factor) || factor <= 0) {
    return jsonApiError("factorRequired");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
  });
  if (!product) return jsonApiError("productNotFound", 404);

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, isActive: true },
  });
  if (!unit) return jsonApiError("unitNotFound", 404);

  try {
    const pkg = await findOrCreatePackage({
      productId,
      unitId,
      factor,
      barcode,
    });
    return jsonOk({
      package: {
        id: pkg.id,
        name: pkg.name,
        factor: pkg.factor,
        barcode: pkg.barcode,
        unit: pkg.unit,
      },
    });
  } catch {
    return jsonApiError("createFailed", 400);
  }
}
