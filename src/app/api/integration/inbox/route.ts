import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireIntegrationAuth } from "@/lib/integration/auth";
import { mapInboxEvent } from "@/lib/integration/inbox-mapper";
import { integrationInboxSchema } from "@/lib/schemas/integration";

export async function POST(request: NextRequest) {
  const authResult = await requireIntegrationAuth(request);
  if (authResult instanceof Response) return authResult;

  const body = await request.json();
  const parsed = integrationInboxSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Некорректные данные запроса" },
      { status: 400 },
    );
  }

  const { source, eventType, externalId, payload } = parsed.data;

  if (externalId) {
    const existing = await prisma.integrationInbox.findFirst({
      where: { source, externalId },
    });
    if (existing) {
      return Response.json({ ok: true, id: existing.id, duplicate: true });
    }
  }

  const row = await prisma.integrationInbox.create({
    data: {
      source,
      eventType,
      externalId: externalId || null,
      payload: JSON.stringify(payload),
      status: "received",
    },
  });

  const result = await mapInboxEvent(prisma, {
    source,
    eventType,
    externalId: externalId || null,
    payload,
  });

  if (result.ok) {
    await prisma.integrationInbox.update({
      where: { id: row.id },
      data: {
        status: "processed",
        processedAt: new Date(),
        lastError: null,
      },
    });
    return Response.json({ ok: true, id: row.id, message: result.message });
  }

  await prisma.integrationInbox.update({
    where: { id: row.id },
    data: {
      status: "failed",
      lastError: result.error,
    },
  });

  return Response.json(
    { ok: false, id: row.id, error: result.error },
    { status: 422 },
  );
}
