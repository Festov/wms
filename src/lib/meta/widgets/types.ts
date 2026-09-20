export type RefOption = { id: string; label: string };

export type MetaFieldContext = {
  counterparties?: RefOption[];
  docks?: (RefOption & { disabled?: boolean })[];
  transportUnits?: RefOption[];
  extraRefOptions?: Record<string, RefOption[]>;
};
