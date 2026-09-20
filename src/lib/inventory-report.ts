import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveProductIdsByMetaFilter } from "@/lib/inventory-meta-filters";
import { packageCountFromBase } from "@/lib/stock";

export const INVENTORY_PAGE_SIZE = 50;
export const INVENTORY_EXPORT_MAX = 10_000;
export const INVENTORY_AGGREGATE_MAX = 50_000;

export type InventoryGroupBy = "detail" | "product" | "zone" | "location";

export type InventoryReportParams = {
  q: string;
  zoneId: string;
  location: string;
  lot: string;
  pallet: string;
  accountingModelId: string;
  metaAttr: string;
  metaValue: string;
  expiringDays: number | null;
  groupBy: InventoryGroupBy;
  page: number;
  preset: string;
  hasFilters: boolean;
  shouldRun: boolean;
};

export type InventoryPreset = {
  id: string;
  label: string;
  hint?: string;
  lotsOnly?: boolean;
  params: Partial<
    Pick<
      InventoryReportParams,
      | "groupBy"
      | "expiringDays"
      | "zoneId"
      | "q"
      | "location"
      | "lot"
      | "pallet"
    >
  >;
};

export const INVENTORY_PRESETS: InventoryPreset[] = [
  {
    id: "summary-product",
    label: "Сводка по товарам",
    hint: "Итоги по SKU",
    params: { groupBy: "product" },
  },
  {
    id: "summary-zone",
    label: "Сводка по зонам",
    hint: "Товар × зона",
    params: { groupBy: "zone" },
  },
  {
    id: "summary-location",
    label: "Сводка по ячейкам",
    hint: "Товар × ячейка",
    params: { groupBy: "location" },
  },
  {
    id: "expiring-7",
    label: "Срок < 7 дн.",
    hint: "Партии",
    lotsOnly: true,
    params: { expiringDays: 7, groupBy: "detail" },
  },
  {
    id: "expiring-30",
    label: "Срок < 30 дн.",
    hint: "Партии",
    lotsOnly: true,
    params: { expiringDays: 30, groupBy: "detail" },
  },
];

const balanceInclude = {
  product: { include: { unit: true, accountingModel: true } },
  location: { include: { zone: true } },
  lot: true,
  package: { include: { unit: true } },
  pallet: true,
} as const;

export type InventoryDetailRow = Prisma.StockBalanceGetPayload<{
  include: typeof balanceInclude;
}>;

export type InventoryGroupRow = {
  key: string;
  groupBy: Exclude<InventoryGroupBy, "detail">;
  product: InventoryDetailRow["product"];
  zoneName: string | null;
  zoneId: string | null;
  locationCode: string | null;
  locationId: string | null;
  quantity: number;
  lineCount: number;
};

export type InventoryReportResult =
  | {
      mode: "detail";
      rows: InventoryDetailRow[];
      totalCount: number;
      truncated?: boolean;
    }
  | {
      mode: "group";
      rows: InventoryGroupRow[];
      totalCount: number;
      truncated?: boolean;
    };

function int(raw: string | undefined) {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function presetDefaults(presetId: string) {
  const preset = INVENTORY_PRESETS.find((p) => p.id === presetId);
  return preset?.params ?? {};
}

export function parseInventoryReportParams(
  raw: Record<string, string | undefined>,
): InventoryReportParams {
  const fromPreset = presetDefaults(raw.preset?.trim() ?? "");

  const q = (raw.q ?? fromPreset.q ?? "").trim();
  const zoneId = (raw.zoneId ?? fromPreset.zoneId ?? "").trim();
  const location = (raw.location ?? fromPreset.location ?? "").trim();
  const lot = (raw.lot ?? fromPreset.lot ?? "").trim();
  const pallet = (raw.pallet ?? fromPreset.pallet ?? "").trim();
  const accountingModelId = (raw.accountingModelId ?? "").trim();
  const metaAttr = (raw.metaAttr ?? "").trim();
  const metaValue = (raw.metaValue ?? "").trim();
  const expiringDays =
    int(raw.expiringDays) ?? fromPreset.expiringDays ?? null;
  const groupBy = parseGroupBy(raw.groupBy ?? fromPreset.groupBy);
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const preset = raw.preset?.trim() ?? "";

  const hasStandardFilters = Boolean(
    q ||
      zoneId ||
      location ||
      lot ||
      pallet ||
      accountingModelId ||
      (metaAttr && metaValue) ||
      expiringDays != null,
  );
  const shouldRun = groupBy !== "detail" || hasStandardFilters;

  return {
    q,
    zoneId,
    location,
    lot,
    pallet,
    accountingModelId,
    metaAttr,
    metaValue,
    expiringDays,
    groupBy,
    page,
    preset,
    hasFilters: hasStandardFilters,
    shouldRun,
  };
}

function parseGroupBy(raw: string | undefined): InventoryGroupBy {
  if (raw === "product" || raw === "zone" || raw === "location") return raw;
  return "detail";
}

export async function buildBalanceWhere(
  params: Pick<
    InventoryReportParams,
    | "q"
    | "zoneId"
    | "location"
    | "lot"
    | "pallet"
    | "accountingModelId"
    | "metaAttr"
    | "metaValue"
    | "expiringDays"
  >,
): Promise<Prisma.StockBalanceWhereInput | null> {
  const where: Prisma.StockBalanceWhereInput = { quantity: { not: 0 } };
  const and: Prisma.StockBalanceWhereInput[] = [];

  const metaProductIds = await resolveProductIdsByMetaFilter(
    params.metaAttr,
    params.metaValue,
  );
  if (metaProductIds !== null) {
    if (metaProductIds.length === 0) {
      return { productId: { in: [] } };
    }
    and.push({ productId: { in: metaProductIds } });
  }

  if (params.q) {
    and.push({
      OR: [
        { product: { sku: { contains: params.q } } },
        { product: { name: { contains: params.q } } },
      ],
    });
  }
  if (params.accountingModelId) {
    and.push({ product: { accountingModelId: params.accountingModelId } });
  }
  if (params.zoneId) {
    and.push({ location: { zoneId: params.zoneId } });
  }
  if (params.location) {
    and.push({
      OR: [
        { location: { code: { contains: params.location } } },
        { location: { name: { contains: params.location } } },
      ],
    });
  }
  if (params.lot) {
    and.push({ lot: { number: { contains: params.lot } } });
  }
  if (params.pallet) {
    and.push({ pallet: { code: { contains: params.pallet } } });
  }
  if (params.expiringDays != null) {
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + params.expiringDays);
    and.push({
      lot: {
        expiryDate: { not: null, gte: now, lte: until },
      },
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export function inventoryReportQueryString(
  params: InventoryReportParams,
  overrides?: Partial<InventoryReportParams & { page?: number }>,
) {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.zoneId) sp.set("zoneId", merged.zoneId);
  if (merged.location) sp.set("location", merged.location);
  if (merged.lot) sp.set("lot", merged.lot);
  if (merged.pallet) sp.set("pallet", merged.pallet);
  if (merged.accountingModelId) sp.set("accountingModelId", merged.accountingModelId);
  if (merged.metaAttr) sp.set("metaAttr", merged.metaAttr);
  if (merged.metaValue) sp.set("metaValue", merged.metaValue);
  if (merged.expiringDays != null) sp.set("expiringDays", String(merged.expiringDays));
  if (merged.groupBy !== "detail") sp.set("groupBy", merged.groupBy);
  if (merged.preset) sp.set("preset", merged.preset);
  const page = overrides?.page ?? merged.page;
  if (page > 1) sp.set("page", String(page));
  return sp.toString();
}

export function inventoryPresetHref(presetId: string) {
  const params = parseInventoryReportParams({ preset: presetId });
  return `/inventory?${inventoryReportQueryString(params)}`;
}

export function inventoryFilterLabels(
  params: InventoryReportParams,
  zones: { id: string; name: string }[],
  accountingModels: { id: string; name: string }[],
  metaAttrs: { code: string; name: string }[],
) {
  const parts: string[] = [];
  if (params.groupBy === "product") parts.push("группировка: товар");
  if (params.groupBy === "zone") parts.push("группировка: зона");
  if (params.groupBy === "location") parts.push("группировка: ячейка");
  if (params.q) parts.push(`товар «${params.q}»`);
  if (params.zoneId) {
    const zone = zones.find((z) => z.id === params.zoneId);
    parts.push(zone ? `зона «${zone.name}»` : "зона");
  }
  if (params.location) parts.push(`ячейка «${params.location}»`);
  if (params.lot) parts.push(`партия «${params.lot}»`);
  if (params.pallet) parts.push(`ТН «${params.pallet}»`);
  if (params.accountingModelId) {
    const model = accountingModels.find((m) => m.id === params.accountingModelId);
    parts.push(model ? `модель «${model.name}»` : "модель учёта");
  }
  if (params.metaAttr && params.metaValue) {
    const attr = metaAttrs.find((a) => a.code === params.metaAttr);
    parts.push(
      `${attr?.name ?? params.metaAttr} «${params.metaValue}»`,
    );
  }
  if (params.expiringDays != null) {
    parts.push(`срок < ${params.expiringDays} дн.`);
  }
  return parts;
}

export async function queryInventoryReport(
  params: InventoryReportParams,
  options?: { pageSize?: number; forExport?: boolean },
): Promise<InventoryReportResult | null> {
  if (!params.shouldRun) return null;

  const where = await buildBalanceWhere(params);
  if (!where) return null;

  const pageSize = options?.pageSize ?? INVENTORY_PAGE_SIZE;
  const forExport = options?.forExport ?? false;

  if (params.groupBy === "detail") {
    const take = forExport ? INVENTORY_EXPORT_MAX : pageSize;
    const skip = forExport ? 0 : (params.page - 1) * pageSize;
    const [rows, totalCount] = await Promise.all([
      prisma.stockBalance.findMany({
        where,
        orderBy: [
          { location: { code: "asc" } },
          { product: { sku: "asc" } },
        ],
        include: balanceInclude,
        skip,
        take,
      }),
      prisma.stockBalance.count({ where }),
    ]);
    return {
      mode: "detail",
      rows,
      totalCount,
      truncated: forExport && totalCount > INVENTORY_EXPORT_MAX,
    };
  }

  return queryGroupedReport(where, params.groupBy, params.page, pageSize, forExport);
}

async function queryGroupedReport(
  where: Prisma.StockBalanceWhereInput,
  groupBy: Exclude<InventoryGroupBy, "detail">,
  page: number,
  pageSize: number,
  forExport: boolean,
): Promise<InventoryReportResult> {
  if (groupBy === "product") {
    const grouped = await prisma.stockBalance.groupBy({
      by: ["productId"],
      where,
      _sum: { quantity: true },
      _count: { _all: true },
      orderBy: { productId: "asc" },
    });
    const productIds = grouped.map((g) => g.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { unit: true, accountingModel: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const allRows: InventoryGroupRow[] = [];
    for (const g of grouped) {
      const product = productMap.get(g.productId);
      if (!product) continue;
      allRows.push({
        key: g.productId,
        groupBy: "product",
        product,
        zoneName: null,
        zoneId: null,
        locationCode: null,
        locationId: null,
        quantity: g._sum.quantity ?? 0,
        lineCount: g._count._all,
      });
    }

    const totalCount = allRows.length;
    const rows = forExport
      ? allRows.slice(0, INVENTORY_EXPORT_MAX)
      : allRows.slice((page - 1) * pageSize, page * pageSize);

    return {
      mode: "group",
      rows,
      totalCount,
      truncated: forExport && totalCount > INVENTORY_EXPORT_MAX,
    };
  }

  const balances = await prisma.stockBalance.findMany({
    where,
    select: {
      quantity: true,
      productId: true,
      locationId: true,
      product: { include: { unit: true, accountingModel: true } },
      location: {
        select: {
          id: true,
          code: true,
          zoneId: true,
          zone: { select: { id: true, name: true } },
        },
      },
    },
    take: INVENTORY_AGGREGATE_MAX + 1,
  });

  const truncated = balances.length > INVENTORY_AGGREGATE_MAX;
  const slice = truncated ? balances.slice(0, INVENTORY_AGGREGATE_MAX) : balances;

  const map = new Map<string, InventoryGroupRow>();
  for (const b of slice) {
    const zoneId = b.location.zoneId;
    const zoneName = b.location.zone?.name ?? "—";
    const key =
      groupBy === "zone"
        ? `${zoneId ?? "none"}:${b.productId}`
        : `${b.locationId}:${b.productId}`;

    const existing = map.get(key);
    if (existing) {
      existing.quantity += b.quantity;
      existing.lineCount += 1;
    } else {
      map.set(key, {
        key,
        groupBy,
        product: b.product,
        zoneId: zoneId ?? null,
        zoneName: groupBy === "zone" || groupBy === "location" ? zoneName : null,
        locationCode: groupBy === "location" ? b.location.code : null,
        locationId: groupBy === "location" ? b.locationId : null,
        quantity: b.quantity,
        lineCount: 1,
      });
    }
  }

  const allRows = [...map.values()].sort((a, b) => {
    const zoneCmp = (a.zoneName ?? "").localeCompare(b.zoneName ?? "", "ru");
    if (zoneCmp !== 0) return zoneCmp;
    const locCmp = (a.locationCode ?? "").localeCompare(b.locationCode ?? "", "ru");
    if (locCmp !== 0) return locCmp;
    return a.product.sku.localeCompare(b.product.sku, "ru");
  });

  const totalCount = allRows.length;
  const rows = forExport
    ? allRows.slice(0, INVENTORY_EXPORT_MAX)
    : allRows.slice((page - 1) * pageSize, page * pageSize);

  return {
    mode: "group",
    rows,
    totalCount,
    truncated: truncated || (forExport && totalCount > INVENTORY_EXPORT_MAX),
  };
}

export function detailRowPackageQty(row: InventoryDetailRow) {
  if (!row.package) return null;
  return packageCountFromBase(row.quantity, row.package.factor);
}

export function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildInventoryExportTable(
  result: InventoryReportResult,
  lotsEnabled: boolean,
  groupBy: InventoryGroupBy = "detail",
): { headers: string[]; rows: (string | number)[][] } {
  if (result.mode === "detail") {
    const headers = [
      "Артикул",
      "Товар",
      "Зона",
      "Ячейка",
      "ТН",
      "Упаковка",
      "Кол-во упак.",
      ...(lotsEnabled ? ["Партия", "Срок годности"] : []),
      "Кол-во баз.",
      "Ед.",
      "Модель учёта",
    ];
    const rows = result.rows.map((b) => {
      const pkgQty = detailRowPackageQty(b);
      return [
        b.product.sku,
        b.product.name,
        b.location.zone?.name ?? "",
        b.location.code,
        b.pallet?.code ?? "",
        b.package?.name ?? "Базовая ед.",
        pkgQty != null ? pkgQty : "",
        ...(lotsEnabled
          ? [
              b.lot?.number ?? "",
              b.lot?.expiryDate
                ? b.lot.expiryDate.toISOString().slice(0, 10)
                : "",
            ]
          : []),
        b.quantity,
        b.product.unit?.name ?? "шт",
        b.product.accountingModel?.name ?? "",
      ];
    });
    return { headers, rows };
  }

  const headers =
    groupBy === "product"
      ? ["Артикул", "Товар", "Кол-во баз.", "Ед.", "Строк остатков", "Модель учёта"]
      : groupBy === "zone"
        ? ["Зона", "Артикул", "Товар", "Кол-во баз.", "Ед.", "Строк остатков"]
        : groupBy === "location"
          ? [
              "Зона",
              "Ячейка",
              "Артикул",
              "Товар",
              "Кол-во баз.",
              "Ед.",
              "Строк остатков",
            ]
          : [];

  const rows: (string | number)[][] = [];
  for (const r of result.rows) {
    if (r.groupBy === "product") {
      rows.push([
        r.product.sku,
        r.product.name,
        r.quantity,
        r.product.unit?.name ?? "шт",
        r.lineCount,
        r.product.accountingModel?.name ?? "",
      ]);
    } else if (r.groupBy === "zone") {
      rows.push([
        r.zoneName ?? "",
        r.product.sku,
        r.product.name,
        r.quantity,
        r.product.unit?.name ?? "шт",
        r.lineCount,
      ]);
    } else {
      rows.push([
        r.zoneName ?? "",
        r.locationCode ?? "",
        r.product.sku,
        r.product.name,
        r.quantity,
        r.product.unit?.name ?? "шт",
        r.lineCount,
      ]);
    }
  }
  return { headers, rows };
}

export function buildInventoryCsv(
  result: InventoryReportResult,
  lotsEnabled: boolean,
  groupBy: InventoryGroupBy = "detail",
) {
  const { headers, rows } = buildInventoryExportTable(
    result,
    lotsEnabled,
    groupBy,
  );
  const lines = [
    headers.map(csvEscape).join(";"),
    ...rows.map((row) => row.map(csvEscape).join(";")),
  ];
  return lines.join("\r\n");
}

export function inventoryExportHref(
  params: InventoryReportParams,
  format: "csv" | "xlsx",
) {
  const qs = inventoryReportQueryString(params);
  return `/api/inventory/export?${qs}&format=${format}`;
}
