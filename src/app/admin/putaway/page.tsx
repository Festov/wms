import { getTranslations } from "next-intl/server";
import {
  Field,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { savePutawayRules } from "@/lib/putaway/actions";
import { ensurePutawayRuleSettings } from "@/lib/putaway/engine";
import { PUTAWAY_RULE_REGISTRY } from "@/lib/putaway/registry";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminPutawayPage() {
  await requireAdmin();
  await ensurePutawayRuleSettings();
  const t = await getTranslations("pages.admin.putaway");
  const tSave = await getTranslations("common");

  const [settings, rules] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.putawayRuleSetting.findMany(),
  ]);
  const byCode = Object.fromEntries(rules.map((r) => [r.code, r]));

  return (
    <Page>
      <PageHeader title={t("title")} description={t("description")} />

      <form action={savePutawayRules} className="space-y-4">
        <Panel>
          <div className="space-y-4">
            {PUTAWAY_RULE_REGISTRY.map((rule) => {
              const row = byCode[rule.code];
              return (
                <div
                  key={rule.code}
                  className="grid gap-3 border-b border-[var(--line)] pb-4 md:grid-cols-[1fr_6rem_auto]"
                >
                  <div>
                    <p className="font-medium">
                      {t(`rules.${rule.code}.title`)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {t(`rules.${rule.code}.description`)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {rule.code}
                    </p>
                  </div>
                  <Field label={t("priority")}>
                    <input
                      className={inputClass}
                      type="number"
                      name={`priority_${rule.code}`}
                      defaultValue={row?.priority ?? rule.defaultPriority}
                    />
                  </Field>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      name={`enabled_${rule.code}`}
                      defaultChecked={row?.enabled ?? rule.defaultEnabled}
                      className="size-4"
                    />
                    {t("enabled")}
                  </label>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={t("behavior")}>
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                name="putawayAllowOverride"
                defaultChecked={settings?.putawayAllowOverride ?? true}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="font-medium">{t("manualOverride")}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {t("manualOverrideHint")}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                name="tsdShowPutawayAfterReceive"
                defaultChecked={settings?.tsdShowPutawayAfterReceive ?? true}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="font-medium">{t("putawayAfterReceive")}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {t("putawayAfterReceiveHint")}
                </span>
              </span>
            </label>
          </div>
        </Panel>

        <button className={buttonClass} type="submit">
          {tSave("save")}
        </button>
      </form>
    </Page>
  );
}
