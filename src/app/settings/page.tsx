import { clearDatabaseSecure, updateSettingsSecure } from "@/lib/admin-actions";
import { ConfirmForm } from "@/components/confirm-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { prisma } from "@/lib/db";
import {
  getAlwaysOnModules,
  getToggleableModules,
  NAV_GROUP_ORDER,
  type ModuleDefinition,
} from "@/lib/modules/registry";
import { getAppSetting } from "@/lib/settings/storage";
import { requireAdmin } from "@/lib/session";
import { translateModuleTitle, translateNavGroup } from "@/lib/i18n/labels";
import {
  Field,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonDangerCompactClass,
  inputClass,
} from "@/components/ui";
import { getTranslations } from "next-intl/server";

function moduleChecked(
  settings: Awaited<ReturnType<typeof prisma.settings.findUnique>>,
  mod: ModuleDefinition,
) {
  if (!mod.settingsFlag) return false;
  return settings?.[mod.settingsFlag] ?? false;
}

export default async function SettingsPage() {
  await requireAdmin();
  const t = await getTranslations();
  const tSettings = await getTranslations("settings");
  const tCommon = await getTranslations("common");

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const overviewRecentMovementsLimit = await getAppSetting(
    "overviewRecentMovementsLimit",
  );

  const toggleable = getToggleableModules();
  const alwaysOn = getAlwaysOnModules();
  const moduleGroups = NAV_GROUP_ORDER.filter((group) =>
    toggleable.some((m) => m.navGroup === group),
  );

  return (
    <Page>
      <PageHeader
        title={tSettings("title")}
        description={tSettings("description")}
      />

      <form action={updateSettingsSecure} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel sectionLabel={tSettings("warehouseSection")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tSettings("warehouseName")}>
                <input
                  className={inputClass}
                  name="warehouseName"
                  defaultValue={settings?.warehouseName ?? tCommon("warehouseDefault")}
                  required
                />
              </Field>
              <Field label={tSettings("warehouseCode")}>
                <input
                  className={inputClass}
                  name="warehouseCode"
                  defaultValue={settings?.warehouseCode ?? "WH-01"}
                  required
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {tSettings("warehouseHint")}
            </p>
          </Panel>

          <Panel sectionLabel={tSettings("tsdSection")}>
            <div className="space-y-3">
              <Field label={tSettings("tsdApiKey")}>
                <input
                  className={inputClass}
                  name="tsdApiKey"
                  defaultValue={settings?.tsdApiKey ?? ""}
                  placeholder={tSettings("tsdApiKeyPlaceholder")}
                  required
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="allowNegativeStock"
                  defaultChecked={settings?.allowNegativeStock ?? false}
                  className="size-4"
                />
                {tSettings("allowNegativeStock")}
              </label>
              <Field label={tSettings("overviewMovements")}>
                <input
                  className={inputClass}
                  type="number"
                  name="overviewRecentMovementsLimit"
                  min={1}
                  max={100}
                  defaultValue={overviewRecentMovementsLimit}
                  required
                />
              </Field>
            </div>
          </Panel>
        </div>

        <Panel sectionLabel={tSettings("languageSection")}>
          <p className="mb-3 text-sm text-[var(--muted)]">
            {tSettings("languageHint")}
          </p>
          <Field label={tCommon("language")}>
            <LanguageSwitcher
              labels={{
                ru: tCommon("russian"),
                en: tCommon("english"),
              }}
            />
          </Field>
        </Panel>

        <Panel sectionLabel={tSettings("modulesSection")}>
          <div className="mb-4 flex flex-wrap gap-2">
            {alwaysOn.map((mod) => (
              <span
                key={mod.code}
                className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)]"
              >
                {translateModuleTitle(mod.code, t)} — {tCommon("alwaysOn")}
              </span>
            ))}
          </div>

          <div className="space-y-5">
            {moduleGroups.map((group) => {
              const items = toggleable.filter((m) => m.navGroup === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {translateNavGroup(group, t)}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {items.map((mod) => (
                      <label
                        key={mod.code}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5 transition-colors hover:bg-[var(--surface)]/60 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--surface)]"
                      >
                        <input
                          type="checkbox"
                          name={mod.settingsFlag}
                          defaultChecked={moduleChecked(settings, mod)}
                          className="size-4 shrink-0"
                        />
                        <span className="text-sm font-medium">
                          {translateModuleTitle(mod.code, t)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <button className={buttonClass} type="submit">
          {tCommon("save")}
        </button>
      </form>

      <Panel sectionLabel={tSettings("clearDbSection")}>
        <p className="mb-3 text-sm text-[var(--muted)]">
          {tSettings("clearDbDescription")}
        </p>
        <ConfirmForm
          action={clearDatabaseSecure}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          message={tSettings("clearDbConfirmMessage")}
        >
          <Field
            label={tSettings("clearDbConfirmLabel")}
            className="sm:max-w-xs"
          >
            <input
              className={inputClass}
              name="confirm"
              autoComplete="off"
              placeholder={tSettings("clearDbConfirmPlaceholder")}
              required
            />
          </Field>
          <button type="submit" className={buttonDangerCompactClass}>
            {tSettings("clearDbButton")}
          </button>
        </ConfirmForm>
      </Panel>
    </Page>
  );
}
