import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";

const WORKFLOW_TRIGGER_LABEL_KEYS: Record<string, string> = {
  "К исполнению": "seed.workflowTriggers.releaseToExecution",
  Отменить: "seed.workflowTriggers.cancel",
  "Вернуть в черновик": "seed.workflowTriggers.returnToDraft",
  "Принять (ТСД)": "seed.workflowTriggers.receiveTsd",
  Размещён: "seed.workflowTriggers.placed",
  "Авто: все ТН размещены": "seed.workflowTriggers.autoAllLinesPlaced",
  "Размещён (legacy)": "seed.workflowTriggers.placedLegacy",
  Провести: "seed.workflowTriggers.post",
  "Отбор (ТСД)": "seed.workflowTriggers.pickTsd",
  Выполнено: "seed.workflowTriggers.completed",
};

export function resolveRoleName(
  code: string,
  dbName: string,
  locale: AppLocale,
): string {
  return translateSyncWithFallback(`seed.roles.${code}.name`, dbName, locale);
}

export function resolveRoleDescription(
  code: string,
  dbDescription: string | null | undefined,
  locale: AppLocale,
): string {
  if (!dbDescription?.trim()) return "—";
  return translateSyncWithFallback(
    `seed.roles.${code}.description`,
    dbDescription,
    locale,
  );
}

export function resolveWorkflowName(
  code: string,
  dbName: string,
  locale: AppLocale,
): string {
  return translateSyncWithFallback(`seed.workflows.${code}`, dbName, locale);
}

export function resolveWorkflowTriggerLabel(
  dbLabel: string | null | undefined,
  locale: AppLocale,
): string | null {
  if (!dbLabel?.trim()) return null;
  const messageKey = WORKFLOW_TRIGGER_LABEL_KEYS[dbLabel];
  if (!messageKey) return dbLabel;
  return translateSyncWithFallback(messageKey, dbLabel, locale);
}

export function resolveMetaEntityName(
  code: string,
  dbName: string,
  locale: AppLocale,
): string {
  return translateSyncWithFallback(
    `seed.metaEntities.${code}.name`,
    dbName,
    locale,
  );
}

export function resolveMetaEntityPlural(
  code: string,
  dbPlural: string | null | undefined,
  dbName: string,
  locale: AppLocale,
): string {
  const fallback = dbPlural?.trim() || dbName;
  return translateSyncWithFallback(
    `seed.metaEntities.${code}.plural`,
    fallback,
    locale,
  );
}
