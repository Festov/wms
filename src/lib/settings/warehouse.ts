import { cache } from "react";
import { prisma } from "@/lib/db";

export type WarehouseIdentity = {
  name: string;
  code: string;
  title: string;
};

export const getWarehouseIdentity = cache(async (): Promise<WarehouseIdentity> => {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const name = settings?.warehouseName?.trim() || "Склад";
  const code = settings?.warehouseCode?.trim() || "WH-01";
  return { name, code, title: `${name} · ${code}` };
});
