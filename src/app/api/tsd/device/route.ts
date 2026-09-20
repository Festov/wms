import { NextRequest } from "next/server";
import { requireTsdAuth, jsonOk, jsonApiError } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const deviceKey = String(body.deviceKey || "").trim();
  const name = String(body.name || "ТСД").trim();
  if (!deviceKey) return jsonApiError("deviceKeyRequired");

  const session = await auth();
  const device = await prisma.tsdDevice.upsert({
    where: { deviceKey },
    create: {
      deviceKey,
      name,
      userId: session?.user?.id ?? null,
      lastSeenAt: new Date(),
    },
    update: {
      name,
      userId: session?.user?.id ?? undefined,
      lastSeenAt: new Date(),
      isActive: true,
    },
  });

  return jsonOk({ device });
}
