import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";

const DEFAULT_TEMPLATE = "{TYPE}-{####}";

/** Приводит шаблон к виду с плейсхолдерами последовательности. */
export function normalizePalletBarcodeTemplate(
  template: string | null | undefined,
): string {
  let tpl = template?.trim() || DEFAULT_TEMPLATE;

  // Частая ошибка: {TYPE}NNNN / {TYPE}#### без фигурных скобок у номера
  tpl = tpl.replace(/\{(TYPE|CODE)\}(N{2,}|#{2,})(?!\})/gi, "{$1}{$2}");

  // Голый хвост NNNN/#### в конце шаблона
  tpl = tpl.replace(/(?<![{\w])(N{2,}|#{2,})$/g, "{$1}");

  const withSeq1 = renderRaw(tpl, "T", 1);
  const withSeq2 = renderRaw(tpl, "T", 2);
  if (withSeq1 === withSeq2) {
    // Шаблон не меняется от номера — добавляем счётчик
    tpl = `${tpl.replace(/-+$/, "")}-{####}`;
  }

  return tpl;
}

function renderRaw(tpl: string, typeCode: string, seq: number): string {
  return tpl
    .replace(/\{TYPE\}/gi, typeCode)
    .replace(/\{CODE\}/gi, typeCode)
    .replace(/\{(#+|N+)\}/g, (_, pad: string) =>
      String(seq).padStart(pad.length, "0"),
    )
    .replace(/\{SEQ(?::(\d+))?\}/gi, (_m, digits?: string) =>
      String(seq).padStart(Number(digits || 4), "0"),
    );
}

/** Подставляет плейсхолдеры шаблона штрихкода ТН. */
export function renderPalletBarcodeTemplate(
  template: string | null | undefined,
  typeCode: string,
  seq: number,
): string {
  return renderRaw(normalizePalletBarcodeTemplate(template), typeCode, seq);
}

/** Следующий уникальный код/штрихкод по типу ТН и его шаблону. */
export async function allocatePalletCodes(palletTypeId: string) {
  const type = await prisma.palletType.findUniqueOrThrow({
    where: { id: palletTypeId },
  });
  const count = await prisma.pallet.count({ where: { palletTypeId } });
  const template = normalizePalletBarcodeTemplate(type.barcodeTemplate);
  const maxAttempts = Math.max(5000, count + 100);

  for (let seq = 1; seq <= maxAttempts; seq++) {
    const value = renderRaw(template, type.code, seq);
    const exists = await prisma.pallet.findFirst({
      where: { OR: [{ code: value }, { barcode: value }] },
      select: { id: true },
    });
    if (!exists) {
      return { code: value, barcode: value, type, template, seq };
    }
  }

  return throwLocalized("errors.catalog.palletBarcodeAllocateFailed");
}

/** Создать несколько ТН по типу (коды по шаблону). */
export async function createPalletsBatch(
  palletTypeId: string,
  quantity: number,
) {
  const qty = Math.min(500, Math.max(1, Math.floor(quantity)));
  const created: { id: string; code: string; barcode: string }[] = [];

  for (let i = 0; i < qty; i++) {
    const { code, barcode } = await allocatePalletCodes(palletTypeId);
    const row = await prisma.pallet.create({
      data: { code, barcode, palletTypeId, status: "AVAILABLE" },
    });
    created.push({
      id: row.id,
      code: row.code,
      barcode: row.barcode ?? row.code,
    });
  }

  return created;
}
