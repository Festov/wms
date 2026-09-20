import { prisma } from "@/lib/db";

/**
 * Поиск id активной ячейки по коду/штрихкоду без учёта регистра (SQLite COLLATE NOCASE).
 */
export async function findActiveLocationIdByCodeOrBarcode(
  codeOrBarcode: string,
): Promise<string | null> {
  const code = codeOrBarcode.trim();
  if (!code) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Location"
    WHERE "isActive" = 1
      AND (
        "code" = ${code} COLLATE NOCASE
        OR "barcode" = ${code} COLLATE NOCASE
      )
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

/**
 * Поиск id активного ТН по коду/штрихкоду без учёта регистра.
 */
export async function findActivePalletIdByCodeOrBarcode(
  codeOrBarcode: string,
): Promise<string | null> {
  const code = codeOrBarcode.trim();
  if (!code) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Pallet"
    WHERE "isActive" = 1
      AND (
        "code" = ${code} COLLATE NOCASE
        OR "barcode" = ${code} COLLATE NOCASE
      )
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

/** Активная ячейка по id или по коду/штрихкоду (без учёта регистра). */
export async function findActiveLocationByIdOrCode(opts: {
  id?: string;
  code?: string;
}) {
  const idIn = opts.id?.trim();
  if (idIn) {
    return prisma.location.findFirst({ where: { id: idIn, isActive: true } });
  }
  const code = opts.code?.trim();
  if (!code) return null;
  const id = await findActiveLocationIdByCodeOrBarcode(code);
  if (!id) return null;
  return prisma.location.findFirst({ where: { id, isActive: true } });
}

/** Активный ТН по id или по коду/штрихкоду (без учёта регистра). */
export async function findActivePalletByIdOrCode(opts: {
  id?: string;
  code?: string;
}) {
  const idIn = opts.id?.trim();
  if (idIn) {
    return prisma.pallet.findFirst({ where: { id: idIn, isActive: true } });
  }
  const code = opts.code?.trim();
  if (!code) return null;
  const id = await findActivePalletIdByCodeOrBarcode(code);
  if (!id) return null;
  return prisma.pallet.findFirst({ where: { id, isActive: true } });
}
