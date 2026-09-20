import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import {
  MAX_CELLS,
  countCellsFromRackConfig,
  renderCellAddressTemplate,
} from "@/lib/location-batch-utils";

const DEFAULT_CODE_TEMPLATE = "{A}-{R}-{L}-{P}";

export type RackConfigInput = {
  aisle: string;
  rackCount: number;
  levelCount: number;
  positionCount: number;
  zoneId: string;
  codeTemplate?: string | null;
  nameTemplate?: string | null;
};

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

export {
  countCellsFromRackConfig,
  renderCellAddressTemplate,
} from "@/lib/location-batch-utils";

/** Создать ячейки по конфигурации стеллажа (проезд × стеллажи × ярусы × места). */
export async function createLocationsFromRackConfig(input: RackConfigInput) {
  const aisle = String(input.aisle ?? "").trim();
  if (!aisle) return throwLocalized("errors.location.aisleRequired");

  const zoneId = String(input.zoneId ?? "").trim();
  if (!zoneId) return throwLocalized("errors.location.zoneRequired");

  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, isActive: true },
  });
  if (!zone) return throwLocalized("errors.location.zoneNotFound");

  const { racks, levels, positions, total } = countCellsFromRackConfig(input);
  if (total > MAX_CELLS) {
    return throwLocalized("errors.location.tooManyCells", {
      total,
      max: MAX_CELLS,
    });
  }

  const codeTpl = input.codeTemplate?.trim() || DEFAULT_CODE_TEMPLATE;
  const nameTpl = input.nameTemplate?.trim() || "";

  const rackPad = String(racks).length;
  const levelPad = String(levels).length;
  const posPad = String(positions).length;

  const planned: Array<{
    code: string;
    name: string;
    aisle: string;
    rack: string;
    level: string;
    position: string;
  }> = [];

  for (let r = 1; r <= racks; r++) {
    for (let l = 1; l <= levels; l++) {
      for (let p = 1; p <= positions; p++) {
        const parts = {
          aisle,
          rack: pad(r, rackPad),
          level: pad(l, levelPad),
          position: pad(p, posPad),
        };
        const code = renderCellAddressTemplate(codeTpl, parts);
        const name = nameTpl
          ? renderCellAddressTemplate(nameTpl, parts)
          : code;
        planned.push({ code, name, ...parts });
      }
    }
  }

  const codes = planned.map((p) => p.code);
  const existing = await prisma.location.findMany({
    where: { code: { in: codes } },
    select: { code: true },
  });
  if (existing.length > 0) {
    const sample = existing
      .slice(0, 5)
      .map((e) => e.code)
      .join(", ");
    return throwLocalized("errors.location.barcodeExists", {
      sample: `${sample}${existing.length > 5 ? "…" : ""}`,
    });
  }

  const created = await prisma.$transaction(
    planned.map((row) =>
      prisma.location.create({
        data: {
          code: row.code,
          name: row.name,
          barcode: row.code,
          aisle: row.aisle,
          rack: row.rack,
          level: row.level,
          position: row.position,
          zoneId,
          type: zone.type,
        },
      }),
    ),
  );

  return created;
}
