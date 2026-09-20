import { revalidatePath } from "next/cache";

const BARCODE_ENTITIES = new Set([
  "nomenclature",
  "cells",
  "pallets",
  "packages",
]);

/** Обновить хаб НСИ, штрихкоды и топологию после правок справочников. */
export function revalidateCatalogSideEffects(entityCode: string) {
  revalidatePath("/nsi");
  if (BARCODE_ENTITIES.has(entityCode)) {
    revalidatePath("/labels");
  }
  if (entityCode === "cells") {
    revalidatePath("/topology");
  }
}
