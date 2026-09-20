"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireNsiCatalogWrite } from "@/lib/permissions/check";
import { createLocationsFromRackConfig } from "@/lib/location-batch";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function int(formData: FormData, key: string, fallback: number) {
  const n = Number(formData.get(key));
  return Number.isFinite(n) ? n : fallback;
}

export async function createRackCellsAction(formData: FormData) {
  await requireNsiCatalogWrite("cells");

  const created = await createLocationsFromRackConfig({
    aisle: str(formData, "aisle"),
    rackCount: int(formData, "rackCount", 1),
    levelCount: int(formData, "levelCount", 1),
    positionCount: int(formData, "positionCount", 1),
    zoneId: str(formData, "zoneId"),
    codeTemplate: str(formData, "codeTemplate") || null,
    nameTemplate: str(formData, "nameTemplate") || null,
  });

  revalidatePath("/catalog/cells");
  revalidatePath("/topology");
  const returnTo = str(formData, "returnTo");
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    redirect(returnTo);
  }
  if (created.length === 1) {
    redirect(`/catalog/cells/${created[0].id}`);
  }
  redirect("/catalog/cells");
}
