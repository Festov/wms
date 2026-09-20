"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWrite } from "@/lib/session";
import { ensurePutawayRuleSettings } from "@/lib/putaway/engine";
import { PUTAWAY_RULE_REGISTRY } from "@/lib/putaway/registry";

export async function savePutawayRules(formData: FormData) {
  await requireAdminWrite();
  await ensurePutawayRuleSettings();

  for (const rule of PUTAWAY_RULE_REGISTRY) {
    const enabled = formData.get(`enabled_${rule.code}`) === "on";
    const priority = Number(formData.get(`priority_${rule.code}`) ?? rule.defaultPriority);
    await prisma.putawayRuleSetting.update({
      where: { code: rule.code },
      data: {
        enabled,
        priority: Number.isFinite(priority) ? priority : rule.defaultPriority,
      },
    });
  }

  const allowOverride = formData.get("putawayAllowOverride") === "on";
  const showPutawayAfterReceive =
    formData.get("tsdShowPutawayAfterReceive") === "on";
  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      putawayAllowOverride: allowOverride,
      tsdShowPutawayAfterReceive: showPutawayAfterReceive,
    },
    update: {
      putawayAllowOverride: allowOverride,
      tsdShowPutawayAfterReceive: showPutawayAfterReceive,
    },
  });

  const { setAppSetting } = await import("@/lib/settings/storage");
  await setAppSetting("putawayAllowOverride", allowOverride);
  await setAppSetting("tsdShowPutawayAfterReceive", showPutawayAfterReceive);

  revalidatePath("/admin/putaway");
  revalidatePath("/tsd");
  revalidatePath("/tsd/receive");
}
