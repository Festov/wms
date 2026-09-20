import { prisma } from "@/lib/db";
import { createHmac } from "node:crypto";
import { sendOneCEvent } from "@/lib/integration/adapters/one-c";
import { buildOutboxBody, wrapOutboxPayload } from "@/lib/integration/outbox-contract";

export async function enqueueOutbox(input: {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}) {
  const payload =
    typeof input.payload === "object" && input.payload !== null
      ? wrapOutboxPayload(input.payload as Record<string, unknown>)
      : wrapOutboxPayload({ data: input.payload });

  return prisma.integrationOutbox.create({
    data: {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: JSON.stringify(payload),
      status: "pending",
    },
  });
}

async function sendWebhook(
  ep: { url: string | null; secret: string | null },
  event: {
    id: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: string;
    createdAt: Date;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!ep.url) {
    return { ok: false, error: "Не указан URL конечной точки" };
  }
  try {
    const body = JSON.stringify(buildOutboxBody(event));
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (ep.secret) {
      headers["x-signature"] = createHmac("sha256", ep.secret)
        .update(body)
        .digest("hex");
    }
    const res = await fetch(ep.url, { method: "POST", headers, body });
    if (!res.ok) {
      return { ok: false, error: `Ошибка HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка отправки",
    };
  }
}

export async function drainOutbox(limit = 20) {
  const pending = await prisma.integrationOutbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const endpoints = await prisma.integrationEndpoint.findMany({
    where: { isActive: true },
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const event of pending) {
    if (endpoints.length === 0) {
      await prisma.integrationOutbox.update({
        where: { id: event.id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          lastError: "Нет активных конечных точек интеграции",
        },
      });
      results.push({ id: event.id, ok: false, error: "нет конечных точек" });
      continue;
    }

    let allOk = true;
    let lastError: string | undefined;

    for (const ep of endpoints) {
      const sendResult =
        ep.type === "1c"
          ? await sendOneCEvent(ep, event)
          : await sendWebhook(ep, event);

      if (!sendResult.ok) {
        allOk = false;
        lastError = sendResult.error;
      }
    }

    await prisma.integrationOutbox.update({
      where: { id: event.id },
      data: allOk
        ? {
            status: "sent",
            attempts: { increment: 1 },
            processedAt: new Date(),
            lastError: null,
          }
        : {
            status: "pending",
            attempts: { increment: 1 },
            lastError: lastError ?? "ошибка",
          },
    });

    if (!allOk && event.attempts + 1 >= 10) {
      await prisma.integrationOutbox.update({
        where: { id: event.id },
        data: { status: "failed" },
      });
    }

    results.push({ id: event.id, ok: allOk, error: lastError });
  }

  return results;
}

export async function retryFailedOutbox(limit = 20) {
  const failed = await prisma.integrationOutbox.findMany({
    where: { status: "failed" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of failed) {
    await prisma.integrationOutbox.update({
      where: { id: row.id },
      data: { status: "pending", lastError: null },
    });
  }

  return drainOutbox(limit);
}
