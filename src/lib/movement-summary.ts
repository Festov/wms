import { movementTypeLabel } from "@/lib/format";

export type MovementView = {
  type: string;
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  palletId?: string | null;
  product: {
    sku: string;
    name: string;
    unit?: { symbol: string | null; name: string } | null;
  };
  fromLocation?: { code: string } | null;
  toLocation?: { code: string } | null;
  note?: string | null;
};

function unitLabel(m: MovementView) {
  return m.product.unit?.symbol || m.product.unit?.name || "шт";
}

function formatQtyValue(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/\.?0+$/, "");
}

/** Количество со знаком и единицей: «−5 шт», «+10 кг». */
export function formatMovementQuantity(m: MovementView) {
  const unit = unitLabel(m);
  const formatted = formatQtyValue(Math.abs(m.quantity));
  switch (m.type) {
    case "SHIPMENT":
      return `−${formatted} ${unit}`;
    case "RECEIPT":
      return `+${formatted} ${unit}`;
    case "ADJUSTMENT":
      return m.quantity >= 0
        ? `+${formatted} ${unit}`
        : `−${formatted} ${unit}`;
    default:
      return `${formatted} ${unit}`;
  }
}

/** Человекочитаемый маршрут движения. */
export function movementRouteText(m: MovementView) {
  const from = m.fromLocation?.code;
  const to = m.toLocation?.code;

  switch (m.type) {
    case "RECEIPT":
      return to ? `в ячейку ${to}` : "на склад";
    case "SHIPMENT":
      return from ? `из ячейки ${from}` : "со склада";
    case "TRANSFER":
      if (from && to) return `${from} → ${to}`;
      if (from) return `из ${from}`;
      return to ? `в ${to}` : "—";
    case "ADJUSTMENT":
      if (to) return `ячейка ${to}`;
      if (from) return `ячейка ${from}`;
      return "корректировка";
    default:
      if (from && to) return `${from} → ${to}`;
      if (from) return `из ${from}`;
      if (to) return `в ${to}`;
      return "—";
  }
}

/** Краткая строка для узких мест: «Приход · в A-01». */
export function movementSummaryLine(m: MovementView) {
  return `${movementTypeLabel(m.type)} · ${movementRouteText(m)}`;
}