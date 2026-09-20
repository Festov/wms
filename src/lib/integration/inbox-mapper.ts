import type { PrismaClient } from "@/generated/prisma/client";
import { nextDocNumber } from "@/lib/stock";
import { integrationErrorMessage } from "@/lib/i18n/api";
import { getApiLocale } from "@/lib/i18n/locale-server";
import { defaultLocale, type AppLocale } from "@/i18n/config";

export type InboxEvent = {
  source: string;
  eventType: string;
  externalId: string | null;
  payload: unknown;
};

export type InboxMapResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  return payload as Record<string, unknown>;
}

function str(v: unknown) {
  return String(v ?? "").trim();
}

function inboxError(
  key: string,
  locale: AppLocale,
  values?: Record<string, string | number>,
): InboxMapResult {
  return {
    ok: false,
    error: integrationErrorMessage(key, locale, values),
  };
}

async function resolveInboxLocale(): Promise<AppLocale> {
  try {
    return await getApiLocale();
  } catch {
    return defaultLocale;
  }
}

async function upsertProduct(
  tx: PrismaClient,
  data: Record<string, unknown>,
  locale: AppLocale,
): Promise<InboxMapResult> {
  const sku = str(data.sku);
  const name = str(data.name);
  if (!sku || !name) {
    return inboxError("productUpsertFieldsRequired", locale);
  }

  const unitCode = str(data.unitCode) || "PCE";
  const unit = await tx.unit.upsert({
    where: { code: unitCode },
    create: { code: unitCode, name: unitCode, symbol: unitCode },
    update: {},
  });

  await tx.product.upsert({
    where: { sku },
    create: {
      sku,
      name,
      barcode: str(data.barcode) || null,
      unitId: unit.id,
      isActive: data.isActive !== false,
    },
    update: {
      name,
      barcode: str(data.barcode) || null,
      isActive: data.isActive !== false,
    },
  });

  return { ok: true, message: `product ${sku}` };
}

async function upsertCounterparty(
  tx: PrismaClient,
  data: Record<string, unknown>,
  locale: AppLocale,
): Promise<InboxMapResult> {
  const code = str(data.code) || str(data.inn) || str(data.externalId);
  const name = str(data.name);
  if (!code || !name) {
    return inboxError("counterpartyUpsertFieldsRequired", locale);
  }

  const kindRaw = str(data.kind).toUpperCase();
  const kind =
    kindRaw === "SUPPLIER" || kindRaw === "CUSTOMER" || kindRaw === "BOTH"
      ? kindRaw
      : "BOTH";

  await tx.counterparty.upsert({
    where: { code },
    create: {
      code,
      name,
      kind,
      inn: str(data.inn) || null,
      kpp: str(data.kpp) || null,
      isActive: data.isActive !== false,
    },
    update: {
      name,
      kind,
      inn: str(data.inn) || null,
      kpp: str(data.kpp) || null,
      isActive: data.isActive !== false,
    },
  });

  return { ok: true, message: `counterparty ${code}` };
}

async function createInbound(
  tx: PrismaClient,
  data: Record<string, unknown>,
  locale: AppLocale,
): Promise<InboxMapResult> {
  const supplierName = str(data.supplierName) || str(data.supplier);
  const lines = Array.isArray(data.lines) ? data.lines : [];
  if (!supplierName || lines.length === 0) {
    return inboxError("inboundCreateFieldsRequired", locale);
  }

  const number =
    str(data.number) || ((await nextDocNumber("IN")) as string);

  const existing = await tx.inboundDocument.findUnique({ where: { number } });
  if (existing) {
    return { ok: true, message: `inbound ${number} exists` };
  }

  const lineCreates: Array<{
    productId: string;
    packageId: string | null;
    packageQty: number | null;
    quantity: number;
    lineNo: number;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const sku = str(r.sku);
    const qty = Number(r.quantity);
    if (!sku || !Number.isFinite(qty) || qty <= 0) continue;

    const product = await tx.product.findUnique({ where: { sku } });
    if (!product) {
      return inboxError("inboundProductNotFound", locale, { sku });
    }

    lineCreates.push({
      productId: product.id,
      packageId: null,
      packageQty: null,
      quantity: qty,
      lineNo: i + 1,
    });
  }

  if (lineCreates.length === 0) {
    return inboxError("inboundNoValidLines", locale);
  }

  await tx.inboundDocument.create({
    data: {
      number,
      supplier: supplierName,
      externalRef: str(data.externalRef) || null,
      status: "DRAFT",
      lines: { create: lineCreates },
    },
  });

  return { ok: true, message: `inbound ${number}` };
}

async function createOutbound(
  tx: PrismaClient,
  data: Record<string, unknown>,
  locale: AppLocale,
): Promise<InboxMapResult> {
  const customerName = str(data.customerName) || str(data.customer);
  const lines = Array.isArray(data.lines) ? data.lines : [];
  if (!customerName || lines.length === 0) {
    return inboxError("outboundCreateFieldsRequired", locale);
  }

  const number = str(data.number) || ((await nextDocNumber("OUT")) as string);
  const existing = await tx.outboundDocument.findUnique({ where: { number } });
  if (existing) {
    return { ok: true, message: `outbound ${number} exists` };
  }

  const settings = await tx.settings.findUnique({ where: { id: 1 } });
  let defaultLocationId = settings?.defaultShippingLocId ?? null;
  if (!defaultLocationId) {
    const fallback = await tx.location.findFirst({
      where: { isActive: true, type: "STORAGE" },
      orderBy: { code: "asc" },
    });
    defaultLocationId = fallback?.id ?? null;
  }
  if (!defaultLocationId) {
    return inboxError("outboundNoShippingLocation", locale);
  }

  const lineCreates: Array<{
    productId: string;
    locationId: string;
    quantity: number;
    lineNo: number;
    packageId: string | null;
    packageQty: number | null;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const sku = str(r.sku);
    const qty = Number(r.quantity);
    if (!sku || !Number.isFinite(qty) || qty <= 0) continue;

    const product = await tx.product.findUnique({ where: { sku } });
    if (!product) {
      return inboxError("outboundProductNotFound", locale, { sku });
    }

    lineCreates.push({
      productId: product.id,
      locationId: defaultLocationId,
      quantity: qty,
      lineNo: i + 1,
      packageId: null,
      packageQty: null,
    });
  }

  if (lineCreates.length === 0) {
    return inboxError("outboundNoValidLines", locale);
  }

  await tx.outboundDocument.create({
    data: {
      number,
      customer: customerName,
      externalRef: str(data.externalRef) || null,
      status: "DRAFT",
      lines: { create: lineCreates },
    },
  });

  return { ok: true, message: `outbound ${number}` };
}

async function upsertLocation(
  tx: PrismaClient,
  data: Record<string, unknown>,
  locale: AppLocale,
): Promise<InboxMapResult> {
  const code = str(data.code);
  const name = str(data.name) || code;
  if (!code) {
    return inboxError("locationUpsertCodeRequired", locale);
  }

  const zoneCode = str(data.zoneCode) || "DEFAULT";
  const zone = await tx.zone.upsert({
    where: { code: zoneCode },
    create: { code: zoneCode, name: zoneCode },
    update: {},
  });

  const typeRaw = str(data.type).toUpperCase();
  const type =
    typeRaw === "RECEIVING" ||
    typeRaw === "STORAGE" ||
    typeRaw === "SHIPPING" ||
    typeRaw === "QUARANTINE"
      ? typeRaw
      : "STORAGE";

  await tx.location.upsert({
    where: { code },
    create: {
      code,
      name,
      zoneId: zone.id,
      type,
      isActive: data.isActive !== false,
    },
    update: {
      name,
      type,
      isActive: data.isActive !== false,
    },
  });

  return { ok: true, message: `location ${code}` };
}

async function stockSnapshot(
  tx: PrismaClient,
  data: Record<string, unknown>,
): Promise<InboxMapResult> {
  const sku = str(data.sku);
  const where = sku
    ? { product: { sku }, quantity: { gt: 0 } }
    : { quantity: { gt: 0 } };

  const balances = await tx.stockBalance.findMany({
    where,
    include: {
      product: { select: { sku: true, name: true } },
      location: { select: { code: true } },
      lot: { select: { number: true } },
    },
    take: 500,
  });

  return {
    ok: true,
    message: JSON.stringify({
      count: balances.length,
      items: balances.map((b) => ({
        sku: b.product.sku,
        location: b.location.code,
        lot: b.lot?.number ?? null,
        quantity: b.quantity,
      })),
    }),
  };
}

export async function mapInboxEvent(
  prisma: PrismaClient,
  event: InboxEvent,
): Promise<InboxMapResult> {
  const locale = await resolveInboxLocale();
  const data = payloadRecord(event.payload);
  if (!data) {
    return inboxError("invalidPayload", locale);
  }

  switch (event.eventType) {
    case "product.upsert":
      return upsertProduct(prisma, data, locale);
    case "counterparty.upsert":
      return upsertCounterparty(prisma, data, locale);
    case "inbound.create":
      return createInbound(prisma, data, locale);
    case "outbound.create":
      return createOutbound(prisma, data, locale);
    case "location.upsert":
      return upsertLocation(prisma, data, locale);
    case "stock.snapshot":
      return stockSnapshot(prisma, data);
    default:
      return inboxError("unsupportedEventType", locale, {
        eventType: event.eventType,
      });
  }
}
