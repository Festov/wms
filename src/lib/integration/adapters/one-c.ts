import { createHmac } from "node:crypto";
import type { IntegrationEndpoint } from "@/generated/prisma/client";
import { buildOutboxBody } from "@/lib/integration/outbox-contract";

export type OneCOutboxEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: string;
  createdAt: Date;
};

/** Отправка события outbox на HTTP-endpoint 1С (OData/REST). */
export async function sendOneCEvent(
  endpoint: IntegrationEndpoint,
  event: OneCOutboxEvent,
): Promise<{ ok: boolean; error?: string }> {
  if (!endpoint.url) {
    return { ok: false, error: "1C endpoint URL empty" };
  }

  const body = JSON.stringify(buildOutboxBody(event));
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-wms-source": "wms",
    "x-wms-event": event.eventType,
  };

  if (endpoint.secret) {
    headers["x-signature"] = createHmac("sha256", endpoint.secret)
      .update(body)
      .digest("hex");
  }

  try {
    const res = await fetch(endpoint.url, { method: "POST", headers, body });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}
