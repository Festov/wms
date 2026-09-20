import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Field,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { TopologyMap } from "@/components/topology-map";
import { updateTopologyCanvas } from "@/lib/module-actions";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";

export default async function TopologyPage() {
  await requireModule("topology");
  const t = await getTranslations("pages.topology");
  const tc = await getTranslations("common");

  const [settings, cells] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: { zone: true },
    }),
  ]);

  const width = settings?.topologyWidth ?? 1200;
  const height = settings?.topologyHeight ?? 800;

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/catalog/cells" className={buttonSecondaryClass}>
            {t("nsiCells")}
          </Link>
        }
      />

      <Panel title={t("mapSize")}>
        <form action={updateTopologyCanvas} className="flex flex-wrap items-end gap-3">
          <Field label={t("width")} className="w-32">
            <input
              className={inputClass}
              name="topologyWidth"
              type="number"
              defaultValue={width}
            />
          </Field>
          <Field label={t("height")} className="w-32">
            <input
              className={inputClass}
              name="topologyHeight"
              type="number"
              defaultValue={height}
            />
          </Field>
          <button className={buttonClass} type="submit">
            {tc("save")}
          </button>
        </form>
      </Panel>

      {cells.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">
            {t("noCells")}{" "}
            <Link href="/catalog/cells/new" className="text-[var(--accent)]">
              {t("noCellsLink")}
            </Link>
            .
          </p>
        </Panel>
      ) : (
        <TopologyMap
          width={width}
          height={height}
          cells={cells.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            mapX: c.mapX,
            mapY: c.mapY,
            mapW: c.mapW,
            mapH: c.mapH,
            type: c.type,
            zone: c.zone
              ? { name: c.zone.name, color: c.zone.color }
              : null,
          }))}
        />
      )}
    </Page>
  );
}
