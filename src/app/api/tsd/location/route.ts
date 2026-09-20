import { NextRequest } from "next/server";
import {
  requireTsdAuth,
  requireTsdReadAccess,
  jsonOk,
  jsonError,
  jsonApiError,
} from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import {
  resolveTsdLocation,
  type LocationPurpose,
} from "@/lib/tsd-location";

export async function GET(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdReadAccess();
  if (denied) return denied;

  const code = request.nextUrl.searchParams.get("code")?.trim();
  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();
  const purposeRaw = request.nextUrl.searchParams.get("purpose")?.trim();
  const purpose = (purposeRaw || "any") as LocationPurpose;

  if (!code && !barcode) return jsonApiError("codeOrBarcodeRequired");
  if (
    purpose !== "any" &&
    purpose !== "receive" &&
    purpose !== "putaway" &&
    purpose !== "pick"
  ) {
    return jsonApiError("invalidPurpose");
  }

  const resolved = await resolveTsdLocation(code || barcode || "", purpose);
  if (!resolved.ok) {
    return jsonError(resolved.error, resolved.notFound ? 404 : 400);
  }

  const full = await prisma.location.findUnique({
    where: { id: resolved.location.id },
    include: {
      zone: true,
      palletType: true,
      balances: {
        where: { quantity: { gt: 0 } },
        include: { product: true, lot: true },
      },
    },
  });

  return jsonOk({ ...full, effectiveType: resolved.location.type });
}
