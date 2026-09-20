export const OUTBOX_CONTRACT_VERSION = 1 as const;

export type OutboxEnvelope = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: OutboxPayload;
  createdAt: string;
};

export type OutboxPayload = {
  version: typeof OUTBOX_CONTRACT_VERSION;
  [key: string]: unknown;
};

export function wrapOutboxPayload(
  data: Record<string, unknown>,
): OutboxPayload {
  return { version: OUTBOX_CONTRACT_VERSION, ...data };
}

export function buildOutboxBody(event: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: string;
  createdAt: Date;
}): OutboxEnvelope {
  const parsed = JSON.parse(event.payload) as Record<string, unknown>;
  const payload: OutboxPayload = {
    version: OUTBOX_CONTRACT_VERSION,
    ...parsed,
  };
  if (payload.version !== OUTBOX_CONTRACT_VERSION) {
    payload.version = OUTBOX_CONTRACT_VERSION;
  }
  return {
    id: event.id,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload,
    createdAt: event.createdAt.toISOString(),
  };
}
