import { NextRequest } from "next/server";
import {
  requireTsdAuth,
  requireTsdPermission,
  jsonOk,
  jsonApiError,
} from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { planPutawayForPallet } from "@/lib/putaway/engine";
import { findActivePalletByIdOrCode } from "@/lib/ci-lookup";

export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;

  const deniedPutaway = await requireTsdPermission("tsd.putaway");
  if (deniedPutaway) return deniedPutaway;

  const body = await request.json();
  const palletCode = String(body.palletCode || body.tnCode || "").trim();
  const palletIdIn = String(body.palletId || "").trim();
  const entry = String(body.entry || "task").trim();

  if (entry === "scan") {
    const deniedScan = await requireTsdPermission("tsd.freePutawayScan");
    if (deniedScan) return deniedScan;
  }

  const pallet = await findActivePalletByIdOrCode({
    id: palletIdIn,
    code: palletCode,
  });
  if (!pallet) return jsonApiError("palletNotFound", 404);
  if (pallet.status !== "ACCEPTED") {
    return jsonApiError("palletNotAccepted");
  }

  const content = await prisma.stockBalance.findMany({
    where: { palletId: pallet.id, quantity: { gt: 0 } },
    include: { product: true, location: true, lot: true },
  });
  if (content.length === 0) {
    return jsonApiError("palletNoStockForPutaway");
  }

  const plan = await planPutawayForPallet(pallet.id);
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  return jsonOk({
    pallet,
    content,
    plan,
    allowOverride: settings?.putawayAllowOverride ?? true,
  });
}
