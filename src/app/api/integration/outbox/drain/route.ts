import { NextRequest } from "next/server";
import { drainOutbox } from "@/lib/integration/outbox";
import { requireIntegrationAuth } from "@/lib/integration/auth";

export async function POST(request: NextRequest) {
  const authResult = await requireIntegrationAuth(request);
  if (authResult instanceof Response) return authResult;

  const results = await drainOutbox(50);
  return Response.json({ ok: true, results });
}
