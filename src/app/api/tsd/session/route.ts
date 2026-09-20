import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { requireTsdAuth, jsonOk, jsonApiError } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { tsdSessionPatchSchema, tsdSessionPostSchema } from "@/lib/schemas/tsd";

/** Start or update a TSD task session */
export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = tsdSessionPostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonApiError("invalidPayload");
  }
  const { type, deviceKey, deviceName, documentId, palletId, locationId } =
    parsed.data;

  const sessionUser = await auth();
  let deviceId: string | null = null;
  if (deviceKey) {
    const device = await prisma.tsdDevice.upsert({
      where: { deviceKey },
      create: {
        deviceKey,
        name: deviceName || "ТСД",
        userId: sessionUser?.user?.id ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        userId: sessionUser?.user?.id ?? undefined,
      },
    });
    deviceId = device.id;
  }

  const session = await prisma.tsdTaskSession.create({
    data: {
      type,
      status: "open",
      userId: sessionUser?.user?.id ?? null,
      deviceId,
      documentId: documentId || null,
      palletId: palletId || null,
      locationId: locationId || null,
    },
  });

  return jsonOk({ session });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = tsdSessionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonApiError("invalidPayload");
  }

  const { id, deviceKey, documentId, palletId, locationId, plannedLocId, status } =
    parsed.data;

  const existing = await prisma.tsdTaskSession.findUnique({
    where: { id },
    include: { device: true },
  });
  if (!existing) return jsonApiError("sessionNotFound", 404);

  const sessionUser = await auth();
  const userId = sessionUser?.user?.id;
  if (existing.userId && userId && existing.userId !== userId) {
    return jsonApiError("forbidden", 403);
  }
  if (
    existing.device?.deviceKey &&
    deviceKey &&
    existing.device.deviceKey !== deviceKey
  ) {
    return jsonApiError("forbidden", 403);
  }

  const session = await prisma.tsdTaskSession.update({
    where: { id },
    data: {
      documentId: documentId !== undefined ? documentId || null : undefined,
      palletId: palletId !== undefined ? palletId || null : undefined,
      locationId: locationId !== undefined ? locationId || null : undefined,
      plannedLocId:
        plannedLocId !== undefined ? plannedLocId || null : undefined,
      status: status || undefined,
      closedAt: status === "closed" ? new Date() : undefined,
    },
  });

  return jsonOk({ session });
}
