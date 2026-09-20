import { prisma } from "@/lib/db";
import {
  allSettingDefinitions,
  getSettingDefinition,
  SETTINGS_REGISTRY,
  type SettingKey,
} from "@/lib/settings/registry";

type SettingValue<K extends SettingKey> =
  (typeof SETTINGS_REGISTRY)[K]["defaultValue"];

export async function getAppSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValue<K>> {
  const def = getSettingDefinition(key);

  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      return def.schema.parse(parsed) as SettingValue<K>;
    } catch {
      /* fall through */
    }
  }

  if ("settingsColumn" in def && def.settingsColumn) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings && def.settingsColumn in settings) {
      const raw = settings[def.settingsColumn as keyof typeof settings];
      try {
        return def.schema.parse(raw) as SettingValue<K>;
      } catch {
        /* fall through */
      }
    }
  }

  return def.defaultValue as SettingValue<K>;
}

export async function setAppSetting(key: SettingKey, value: unknown) {
  const def = getSettingDefinition(key);
  const parsed = def.schema.parse(value);

  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(parsed) },
    update: { value: JSON.stringify(parsed) },
  });

  if ("settingsColumn" in def && def.settingsColumn) {
    await prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        [def.settingsColumn]: parsed,
      } as Parameters<typeof prisma.settings.upsert>[0]["create"],
      update: { [def.settingsColumn]: parsed } as Parameters<
        typeof prisma.settings.upsert
      >[0]["update"],
    });
  }
}

export async function ensureAppSettingsDefaults() {
  for (const def of allSettingDefinitions()) {
    const existing = await prisma.appSetting.findUnique({
      where: { key: def.key },
    });
    if (!existing) {
      await setAppSetting(def.key as SettingKey, def.defaultValue);
    }
  }
}
