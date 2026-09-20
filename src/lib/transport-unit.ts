export function formatTransportUnitLabel(unit: {
  code: string;
  plateNumber: string;
  driverName: string;
  carrierName?: string | null;
}) {
  const carrier = unit.carrierName ? ` · ${unit.carrierName}` : "";
  return `${unit.plateNumber} · ${unit.driverName}${carrier}`;
}
