"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWrite } from "@/lib/session";
import { createIntegrationApiKey } from "@/lib/integration/auth";
import { drainOutbox, retryFailedOutbox } from "@/lib/integration/outbox";
import { mapInboxEvent } from "@/lib/integration/inbox-mapper";

export async function saveWebhookEndpoint(formData: FormData) {
  await requireAdminWrite();
  const url = String(formData.get("url") ?? "").trim() || null;
  const secret = String(formData.get("secret") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";
  await prisma.integrationEndpoint.upsert({
    where: { code: "default_webhook" },
    create: {
      code: "default_webhook",
      name: "Default webhook",
      type: "webhook",
      url,
      secret,
      isActive: Boolean(url) && isActive,
    },
    update: {
      url,
      secret,
      isActive: Boolean(url) && isActive,
    },
  });
  revalidatePath("/admin/integration");
}

export async function saveOneCEndpoint(formData: FormData) {
  await requireAdminWrite();
  const url = String(formData.get("url") ?? "").trim() || null;
  const secret = String(formData.get("secret") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";
  await prisma.integrationEndpoint.upsert({
    where: { code: "default_1c" },
    create: {
      code: "default_1c",
      name: "1C adapter",
      type: "1c",
      url,
      secret,
      isActive: Boolean(url) && isActive,
    },
    update: {
      url,
      secret,
      isActive: Boolean(url) && isActive,
    },
  });
  revalidatePath("/admin/integration");
}

export async function createApiKeyAction(formData: FormData) {
  await requireAdminWrite();
  const name = String(formData.get("name") ?? "API key").trim();
  const created = await createIntegrationApiKey(name);
  revalidatePath("/admin/integration");
  return created.apiKey;
}

export async function drainOutboxAction() {
  await requireAdminWrite();
  await drainOutbox(50);
  await maybeAutoDrainSchedule();
  revalidatePath("/admin/integration");
}

export async function retryFailedOutboxAction() {
  await requireAdminWrite();
  await retryFailedOutbox(50);
  revalidatePath("/admin/integration");
}

async function maybeAutoDrainSchedule() {
  const { getAppSetting, setAppSetting } = await import("@/lib/settings/storage");
  const minutes = await getAppSetting("outboxAutoDrainMinutes");
  if (!minutes || minutes <= 0) return;

  const lastRun = await getAppSetting("outboxLastDrainAt");
  const now = Date.now();
  if (lastRun && now - Number(lastRun) < minutes * 60_000) return;

  await setAppSetting("outboxLastDrainAt", now);
}

export async function retryFailedInboxAction() {
  await requireAdminWrite();
  const failed = await prisma.integrationInbox.findMany({
    where: { status: "failed" },
    take: 20,
    orderBy: { createdAt: "asc" },
  });

  for (const row of failed) {
    const result = await mapInboxEvent(prisma, {
      source: row.source,
      eventType: row.eventType,
      externalId: row.externalId,
      payload: JSON.parse(row.payload),
    });
    await prisma.integrationInbox.update({
      where: { id: row.id },
      data: result.ok
        ? { status: "processed", processedAt: new Date(), lastError: null }
        : { lastError: result.error },
    });
  }

  revalidatePath("/admin/integration");
}
