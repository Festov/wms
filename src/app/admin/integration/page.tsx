import { getTranslations } from "next-intl/server";
import {
  DataTable,
  Field,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { CreateApiKeyForm } from "@/components/create-api-key-form";
import {
  drainOutboxAction,
  retryFailedInboxAction,
  retryFailedOutboxAction,
  saveOneCEndpoint,
  saveWebhookEndpoint,
} from "@/lib/integration/actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminIntegrationPage() {
  await requireAdmin();
  const t = await getTranslations("pages.admin.integration");
  const tc = await getTranslations("pages.common");

  const [webhook, oneC, outbox, inbox, keys] = await Promise.all([
    prisma.integrationEndpoint.findUnique({ where: { code: "default_webhook" } }),
    prisma.integrationEndpoint.findUnique({ where: { code: "default_1c" } }),
    prisma.integrationOutbox.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.integrationInbox.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.integrationApiKey.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <form action={drainOutboxAction}>
              <button className={buttonClass} type="submit">
                {t("drainOutbox")}
              </button>
            </form>
            <form action={retryFailedInboxAction}>
              <button className={buttonSecondaryClass} type="submit">
                {t("retryInbox")}
              </button>
            </form>
            <form action={retryFailedOutboxAction}>
              <button className={buttonSecondaryClass} type="submit">
                {t("retryOutbox")}
              </button>
            </form>
          </div>
        }
      />

      <Panel sectionLabel={t("webhookSection")}>
        <form action={saveWebhookEndpoint} className="grid gap-3 md:grid-cols-2">
          <Field label={t("url")}>
            <input
              className={inputClass}
              name="url"
              defaultValue={webhook?.url ?? ""}
              placeholder="https://example.com/hook"
            />
          </Field>
          <Field label={t("hmacSecret")}>
            <input
              className={inputClass}
              name="secret"
              defaultValue={webhook?.secret ?? ""}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={webhook?.isActive ?? false}
              className="size-4"
            />
            {t("active")}
          </label>
          <div>
            <button className={buttonClass} type="submit">
              {t("saveWebhook")}
            </button>
          </div>
        </form>
      </Panel>

      <Panel sectionLabel={t("oneCSection")}>
        <form action={saveOneCEndpoint} className="grid gap-3 md:grid-cols-2">
          <Field label={t("url")}>
            <input
              className={inputClass}
              name="url"
              defaultValue={oneC?.url ?? ""}
              placeholder="https://1c.example/hs/wms/events"
            />
          </Field>
          <Field label={t("secret")}>
            <input
              className={inputClass}
              name="secret"
              defaultValue={oneC?.secret ?? ""}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={oneC?.isActive ?? false}
              className="size-4"
            />
            {t("active")}
          </label>
          <div>
            <button className={buttonClass} type="submit">
              {t("saveOneC")}
            </button>
          </div>
        </form>
      </Panel>

      <Panel flush sectionLabel={t("apiKeys")}>
        <div className="p-4">
          <CreateApiKeyForm />
        </div>
        <DataTable headers={[t("keyName"), t("prefix"), t("status")]}>
          {keys.map((k) => (
            <tr key={k.id}>
              <td className="px-3 py-2">{k.name}</td>
              <td className="px-3 py-2">{k.keyPrefix}…</td>
              <td className="px-3 py-2">
                {k.isActive ? tc("active") : t("inactive")}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel flush sectionLabel={t("outboxRecent")}>
        <DataTable
          headers={[
            t("event"),
            t("aggregate"),
            t("status"),
            t("attempts"),
            t("error"),
          ]}
        >
          {outbox.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2">{e.eventType}</td>
              <td className="px-3 py-2">
                {e.aggregateType}:{e.aggregateId.slice(0, 8)}
              </td>
              <td className="px-3 py-2">{e.status}</td>
              <td className="px-3 py-2">{e.attempts}</td>
              <td className="px-3 py-2 text-[var(--muted)]">
                {e.lastError ?? "—"}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel flush sectionLabel={t("inboxRecent")}>
        <DataTable
          headers={[
            t("source"),
            t("type"),
            t("status"),
            t("externalId"),
            t("error"),
          ]}
        >
          {inbox.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2">{e.source}</td>
              <td className="px-3 py-2">{e.eventType}</td>
              <td className="px-3 py-2">{e.status}</td>
              <td className="px-3 py-2">{e.externalId ?? "—"}</td>
              <td className="px-3 py-2 text-[var(--muted)]">
                {e.lastError ?? "—"}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </Page>
  );
}
