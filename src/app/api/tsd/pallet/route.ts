import { NextRequest } from "next/server";
import {
  requireTsdAuth,
  requireTsdPermission,
  requireAnyTsdPermission,
  jsonOk,
  jsonApiError,
} from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { allocatePalletCodes } from "@/lib/pallet-code";
import { ensurePredefinedPalletTypes } from "@/lib/meta/seed-predefined";
import { findActivePalletIdByCodeOrBarcode } from "@/lib/ci-lookup";

/** List / create / resolve товарный носитель (pallet) */
export async function GET(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireAnyTsdPermission("tsd.receive", "tsd.putaway");
  if (denied) return denied;

  await ensurePredefinedPalletTypes(prisma);

  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (code) {
    const id = await findActivePalletIdByCodeOrBarcode(code);
    const pallet = id
      ? await prisma.pallet.findFirst({
          where: { id, isActive: true },
          include: {
            palletType: true,
            location: true,
            balances: {
              where: { quantity: { gt: 0 } },
              include: { product: true, lot: true },
            },
          },
        })
      : null;
    if (!pallet) return jsonApiError("palletNotFound", 404);
    if (pallet.status !== "AVAILABLE") {
      if (pallet.status === "ACCEPTED") {
        return jsonApiError("palletAcceptedSelectOtherAvailable");
      }
      if (pallet.status === "PLACED") {
        return jsonApiError("palletPlacedSelectAvailable");
      }
      return jsonApiError("palletAvailableRequiredForReceive");
    }
    return jsonOk({ pallet });
  }

  const types = await prisma.palletType.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  const recent = await prisma.pallet.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { palletType: true, location: true },
  });
  return jsonOk({ types, recent });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.receive");
  if (denied) return denied;

  const body = await request.json();
  const palletTypeId = String(body.palletTypeId || "").trim();
  if (!palletTypeId) return jsonApiError("palletTypeIdRequired");

  const type = await prisma.palletType.findUnique({ where: { id: palletTypeId } });
  if (!type) return jsonApiError("palletTypeNotFound", 404);

  try {
    const { code, barcode } = await allocatePalletCodes(palletTypeId);
    const pallet = await prisma.pallet.create({
      data: {
        code,
        barcode,
        palletTypeId,
        locationId: String(body.locationId || "").trim() || null,
        status: "AVAILABLE",
      },
      include: { palletType: true, location: true },
    });
    return jsonOk({ pallet });
  } catch {
    return jsonApiError("palletCreateFailed", 400);
  }
}
