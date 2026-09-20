import { statusLabelFallback } from "@/lib/status/labels";

/** Разбор `?status=DRAFT,RELEASED` в список кодов статусов. */
export function parseStatusList(raw?: string) {
  if (!raw?.trim()) return undefined;
  const statuses = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return statuses.length > 0 ? statuses : undefined;
}

/** Человекочитаемые подписи статусов для заголовков фильтра. */
export function formatStatusFilterLabel(statuses: string[]) {
  return statuses.map((status) => statusLabelFallback(status)).join(", ");
}
