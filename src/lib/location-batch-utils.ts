const MAX_CELLS = 500;

export { MAX_CELLS };

export function clampRackInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function countCellsFromRackConfig(input: {
  rackCount: number;
  levelCount: number;
  positionCount: number;
}) {
  const racks = clampRackInt(input.rackCount, 1, 50);
  const levels = clampRackInt(input.levelCount, 1, 20);
  const positions = clampRackInt(input.positionCount, 1, 50);
  return {
    racks,
    levels,
    positions,
    total: racks * levels * positions,
  };
}

/** Подставляет плейсхолдеры адреса стеллажа. */
export function renderCellAddressTemplate(
  template: string,
  parts: { aisle: string; rack: string; level: string; position: string },
) {
  return template
    .replace(/\{A\}/gi, parts.aisle)
    .replace(/\{AISLE\}/gi, parts.aisle)
    .replace(/\{R\}/gi, parts.rack)
    .replace(/\{RACK\}/gi, parts.rack)
    .replace(/\{L\}/gi, parts.level)
    .replace(/\{LEVEL\}/gi, parts.level)
    .replace(/\{P\}/gi, parts.position)
    .replace(/\{POS\}/gi, parts.position)
    .replace(/\{POSITION\}/gi, parts.position);
}
