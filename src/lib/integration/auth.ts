import { enqueueOutbox, drainOutbox } from "@/lib/integration/outbox";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";

export { enqueueOutbox, drainOutbox };

export async function requireIntegrationAuth(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  const signature = request.headers.get("x-signature");
  const body = await request.clone().text();

  if (apiKey) {
    const keys = await prisma.integrationApiKey.findMany({
      where: { isActive: true },
    });
    for (const key of keys) {
      if (apiKey.startsWith(key.keyPrefix)) {
        const ok = await bcrypt.compare(apiKey, key.keyHash);
        if (ok) return { mode: "apiKey" as const, keyId: key.id };
      }
    }
    return Response.json({ error: "Некорректный API-ключ" }, { status: 401 });
  }

  const endpoint = await prisma.integrationEndpoint.findFirst({
    where: { isActive: true, type: "webhook" },
  });
  if (endpoint?.secret && signature) {
    const expected = createHmac("sha256", endpoint.secret)
      .update(body)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { mode: "hmac" as const, endpointId: endpoint.id };
    }
  }

  return Response.json({ error: "Требуется авторизация" }, { status: 401 });
}

export async function createIntegrationApiKey(name: string) {
  const raw = `wms_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyHash = await bcrypt.hash(raw, 10);
  const row = await prisma.integrationApiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix: raw.slice(0, 12),
    },
  });
  return { id: row.id, apiKey: raw };
}
