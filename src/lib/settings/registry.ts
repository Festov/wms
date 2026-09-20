import { z } from "zod";
import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";

export type SettingGroup = "warehouse" | "tsd" | "putaway" | "integration" | "ui";

export type SettingDefinition<T = unknown> = {
  key: string;
  title: string;
  description?: string;
  group: SettingGroup;
  schema: z.ZodType<T>;
  defaultValue: T;
  /** Column on Settings model if mirrored there (legacy). */
  settingsColumn?: string;
};

const bool = z.boolean();

export const SETTINGS_REGISTRY = {
  allowNegativeStock: {
    key: "allowNegativeStock",
    title: "Разрешить отрицательные остатки",
    group: "warehouse",
    schema: bool,
    defaultValue: false,
    settingsColumn: "allowNegativeStock",
  },
  putawayAllowOverride: {
    key: "putawayAllowOverride",
    title: "Разрешить ручной выбор ячейки при размещении",
    group: "putaway",
    schema: bool,
    defaultValue: true,
    settingsColumn: "putawayAllowOverride",
  },
  tsdShowPutawayAfterReceive: {
    key: "tsdShowPutawayAfterReceive",
    title: "Кнопка «К размещению» после приёмки на ТСД",
    group: "tsd",
    schema: bool,
    defaultValue: true,
    settingsColumn: "tsdShowPutawayAfterReceive",
  },
  overviewRecentMovementsLimit: {
    key: "overviewRecentMovementsLimit",
    title: "Лимит «Последних движений» на обзоре",
    description: "Сколько строк показывать в блоке последних движений на главной",
    group: "ui",
    schema: z.number().int().min(1).max(100),
    defaultValue: 8,
  },
  outboxAutoDrainMinutes: {
    key: "outboxAutoDrainMinutes",
    title: "Автоотправка исходящих (минуты)",
    description: "0 = отключено. Минимальный интервал между автоматическими отправками исходящих событий.",
    group: "integration",
    schema: z.number().int().min(0).max(1440),
    defaultValue: 0,
  },
  outboxLastDrainAt: {
    key: "outboxLastDrainAt",
    title: "Время последней автоотправки исходящих",
    group: "integration",
    schema: z.number().int().min(0),
    defaultValue: 0,
  },
} as const satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTINGS_REGISTRY;

export function getSettingDefinition(key: SettingKey) {
  return SETTINGS_REGISTRY[key];
}

export function allSettingDefinitions() {
  return Object.values(SETTINGS_REGISTRY);
}

export function resolveSettingTitle(
  key: SettingKey,
  locale: AppLocale = "ru",
) {
  const def = SETTINGS_REGISTRY[key];
  return translateSyncWithFallback(
    `settings.registry.${key}.title`,
    def.title,
    locale,
  );
}

export function resolveSettingDescription(
  key: SettingKey,
  locale: AppLocale = "ru",
) {
  const def = SETTINGS_REGISTRY[key];
  const description =
    "description" in def ? def.description : undefined;
  if (!description) return undefined;
  return translateSyncWithFallback(
    `settings.registry.${key}.description`,
    description,
    locale,
  );
}
