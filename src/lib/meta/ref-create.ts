import type { QuickCreateKind } from "@/components/quick-create-dialog";

export function refCreateKind(refEntityCode: string): QuickCreateKind | null {
  switch (refEntityCode) {
    case "nomenclature":
      return "nomenclature";
    case "counterparties":
      return "counterparty";
    case "cells":
      return "cell";
    case "units":
      return "unit";
    case "zones":
      return "zone";
    default:
      return null;
  }
}
