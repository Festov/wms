export const DOCK_OCCUPYING_INBOUND_STATUSES = ["RELEASED", "ACCEPTED"] as const;
export const DOCK_OCCUPYING_OUTBOUND_STATUSES = ["RELEASED"] as const;

export function receivingDockStatusLabel(status: string) {
  return status === "BUSY" ? "Занята" : "Свободна";
}

export function formatReceivingDockLabel(dock: {
  code: string;
  name: string;
  status: string;
  zone?: { name: string } | null;
}) {
  const zone = dock.zone?.name ? ` · ${dock.zone.name}` : "";
  return `${dock.code} · ${dock.name}${zone} · ${receivingDockStatusLabel(dock.status)}`;
}

/** Краткая подпись для списков документов (без кода и статуса). */
export function formatReceivingDockListLabel(dock: {
  name: string;
  zone?: { name: string } | null;
}) {
  const zone = dock.zone?.name ? ` · ${dock.zone.name}` : "";
  return `${dock.name}${zone}`;
}
