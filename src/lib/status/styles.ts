import type { AppLocale } from "@/i18n/config";
import { resolveLocale } from "@/i18n/config";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import {
  resolveStatusAppearance,
  type StatusCatalog,
} from "@/lib/status/appearance";
import { ensureStatuses } from "@/lib/status/seed";

export type { StatusAppearance, StatusCatalog } from "@/lib/status/appearance";
export {
  DEFAULT_STATUS_APPEARANCE,
  resolveStatusAppearance,
  statusLabelFromCatalog,
} from "@/lib/status/appearance";

export async function getStatusCatalog(
  locale?: AppLocale,
): Promise<StatusCatalog> {
  const resolvedLocale = locale ?? resolveLocale(await getLocale());
  await ensureStatuses(prisma);
  const rows = await prisma.status.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  const catalog: StatusCatalog = {};
  for (const row of rows) {
    catalog[row.code] = resolveStatusAppearance(row.code, row, resolvedLocale);
  }
  return catalog;
}
