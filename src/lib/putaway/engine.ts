import { prisma } from "@/lib/db";
import {
  PUTAWAY_RULE_REGISTRY,
  type PutawayRuleCode,
} from "@/lib/putaway/registry";

export type PutawayPlan = {
  locationId: string;
  locationCode: string;
  locationName: string;
  ruleCode: PutawayRuleCode | "none";
  reason: string;
};

export async function ensurePutawayRuleSettings() {
  for (const rule of PUTAWAY_RULE_REGISTRY) {
    await prisma.putawayRuleSetting.upsert({
      where: { code: rule.code },
      create: {
        code: rule.code,
        enabled: rule.defaultEnabled,
        priority: rule.defaultPriority,
        paramsJson: "{}",
      },
      update: {},
    });
  }
}

async function findSameProductCell(productIds: string[], excludeLocId?: string | null) {
  const bal = await prisma.stockBalance.findFirst({
    where: {
      productId: { in: productIds },
      quantity: { gt: 0 },
      location: {
        isActive: true,
        type: "STORAGE",
        ...(excludeLocId ? { id: { not: excludeLocId } } : {}),
      },
    },
    include: { location: true },
    orderBy: { quantity: "desc" },
  });
  return bal?.location ?? null;
}

async function findEmptyStorageCell(excludeLocId?: string | null) {
  const cells = await prisma.location.findMany({
    where: {
      isActive: true,
      type: "STORAGE",
      ...(excludeLocId ? { id: { not: excludeLocId } } : {}),
    },
    orderBy: { code: "asc" },
    take: 50,
  });
  for (const cell of cells) {
    const qty = await prisma.stockBalance.count({
      where: { locationId: cell.id, quantity: { gt: 0 } },
    });
    if (qty === 0) return cell;
  }
  return null;
}

export async function planPutawayForPallet(
  palletId: string,
): Promise<PutawayPlan | null> {
  await ensurePutawayRuleSettings();

  const pallet = await prisma.pallet.findUnique({
    where: { id: palletId },
    include: {
      balances: {
        where: { quantity: { gt: 0 } },
        select: { productId: true, locationId: true },
      },
    },
  });
  if (!pallet) return null;

  const productIds = [...new Set(pallet.balances.map((b) => b.productId))];
  const currentLoc =
    pallet.locationId ?? pallet.balances[0]?.locationId ?? null;

  const settings = await prisma.putawayRuleSetting.findMany({
    where: { enabled: true },
    orderBy: { priority: "asc" },
  });

  for (const setting of settings) {
    const code = setting.code as PutawayRuleCode;
    if (code === "same_product" && productIds.length > 0) {
      const cell = await findSameProductCell(productIds, currentLoc);
      if (cell) {
        return {
          locationId: cell.id,
          locationCode: cell.code,
          locationName: cell.name,
          ruleCode: "same_product",
          reason: "Ячейка с таким же товаром",
        };
      }
    }
    if (code === "empty_cell") {
      const cell = await findEmptyStorageCell(currentLoc);
      if (cell) {
        return {
          locationId: cell.id,
          locationCode: cell.code,
          locationName: cell.name,
          ruleCode: "empty_cell",
          reason: "Пустая ячейка хранения",
        };
      }
    }
  }

  return null;
}
