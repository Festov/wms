import { NextRequest } from "next/server";
import {
  requireTsdAuth,
  requireTsdPermission,
  jsonOk,
} from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";

/** Список активных единиц измерения для создания упаковки на ТСД. */
export async function GET(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.receive");
  if (denied) return denied;

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return jsonOk(
    units.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      label: u.symbol ? `${u.name} (${u.symbol})` : u.name,
    })),
  );
}
