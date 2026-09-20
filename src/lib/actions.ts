"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { throwActionError } from "@/lib/i18n/locale-server";
import { isWeakTsdApiKey } from "@/lib/security/startup-checks";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function int(formData: FormData, key: string) {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

export async function updateSettings(formData: FormData) {
  const tsdApiKey = str(formData, "tsdApiKey");
  if (isWeakTsdApiKey(tsdApiKey)) {
    await throwActionError("weakTsdApiKey");
  }

  const data = {
    warehouseName: str(formData, "warehouseName") || "Склад",
    warehouseCode: str(formData, "warehouseCode") || "WH-01",
    tsdApiKey,
    allowNegativeStock: bool(formData, "allowNegativeStock"),
    moduleInbound: bool(formData, "moduleInbound"),
    moduleOutbound: bool(formData, "moduleOutbound"),
    moduleTopology: bool(formData, "moduleTopology"),
    moduleLots: bool(formData, "moduleLots"),
    moduleMenus: bool(formData, "moduleMenus"),
    moduleOperations: bool(formData, "moduleOperations"),
    moduleTsd: bool(formData, "moduleTsd"),
  };

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  const { setAppSetting } = await import("@/lib/settings/storage");
  const { getSettingDefinition } = await import("@/lib/settings/registry");
  const movementsLimitDef = getSettingDefinition("overviewRecentMovementsLimit");
  const movementsLimitRaw = int(formData, "overviewRecentMovementsLimit");
  const movementsLimit = movementsLimitDef.schema.parse(
    movementsLimitRaw ?? movementsLimitDef.defaultValue,
  );

  await setAppSetting("allowNegativeStock", data.allowNegativeStock);
  await setAppSetting("overviewRecentMovementsLimit", movementsLimit);

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/nsi");
  revalidatePath("/inventory");
  revalidatePath("/tsd");
}
