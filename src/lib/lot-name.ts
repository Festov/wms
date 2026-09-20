import type { StockTx } from "@/lib/stock";
import { throwLocalized } from "@/lib/i18n/errors-server";

export type LotNameContext = {
  sku: string;
  seq: number;
  /** Сегодня (UTC date parts) */
  now?: Date;
  expiryDate?: Date | null;
  serial?: string | null;
};

function padDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return { y, m, day, ymd: `${y}${m}${day}`, iso: `${y}-${m}-${day}` };
}

/** Подставляет плейсхолдеры шаблона имени партии. */
export function renderLotNameTemplate(
  template: string,
  ctx: LotNameContext,
): string {
  const now = ctx.now ?? new Date();
  const today = padDate(now);
  const exp = ctx.expiryDate ? padDate(ctx.expiryDate) : null;
  const serial = (ctx.serial ?? "").trim();

  return template
    .replace(/\{SKU\}/gi, ctx.sku)
    .replace(/\{SERIAL\}/gi, serial)
    .replace(/\{YYYYMMDD\}/gi, today.ymd)
    .replace(/\{DATE\}/gi, today.iso)
    .replace(/\{EXPIRY\}/gi, exp?.ymd ?? "")
    .replace(/\{EXPIRY:YYYYMMDD\}/gi, exp?.ymd ?? "")
    .replace(/\{EXPIRY:DATE\}/gi, exp?.iso ?? "")
    .replace(/\{(#+|N+)\}/g, (_, pad: string) =>
      String(ctx.seq).padStart(pad.length, "0"),
    )
    .replace(/\{SEQ(?::(\d+))?\}/gi, (_m, digits?: string) =>
      String(ctx.seq).padStart(Number(digits || 4), "0"),
    );
}

/**
 * Выделяет уникальный номер партии по шаблону для товара.
 * Если шаблон без счётчика и уже занят — добавляет -{####}.
 */
export async function allocateLotNumber(
  tx: Pick<StockTx, "lot">,
  productId: string,
  sku: string,
  template: string,
  opts?: {
    expiryDate?: Date | null;
    serial?: string | null;
    now?: Date;
  },
): Promise<string> {
  const tpl = template.trim();
  if (!tpl) return throwLocalized("errors.lot.emptyNameTemplate");

  const count = await tx.lot.findMany({
    where: { productId },
    select: { id: true },
  });
  const start = count.length + 1;
  const maxAttempts = Math.max(2000, start + 100);

  for (let seq = start; seq <= maxAttempts; seq++) {
    let value = renderLotNameTemplate(tpl, {
      sku,
      seq,
      now: opts?.now,
      expiryDate: opts?.expiryDate,
      serial: opts?.serial,
    }).trim();
    if (!value) continue;

    const exists = await tx.lot.findUnique({
      where: { productId_number: { productId, number: value } },
      select: { id: true },
    });
    if (!exists) return value;

    // Шаблон без счётчика — форсируем суффикс
    if (!/\{(#+|N+|SEQ(?::\d+)?)\}/i.test(tpl)) {
      value = `${value}-${String(seq).padStart(4, "0")}`;
      const again = await tx.lot.findUnique({
        where: { productId_number: { productId, number: value } },
        select: { id: true },
      });
      if (!again) return value;
    }
  }

  return throwLocalized("errors.lot.allocateFailed");
}
