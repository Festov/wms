import type { ModuleCode } from "@/lib/modules/registry";
import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";
import {
  buildCustomUiMatrixRows,
  buildNsiCustomCatalogMatrixRows,
  buildNsiCustomDocumentMatrixRows,
  isDynamicPermissionCode,
  viewPermissionForDynamicWriteCode,
  type CustomUiPermissionContext,
} from "@/lib/menu/permissions";
import {
  NSI_CATALOG_ENTRIES,
  NSI_HUB_PERMISSION,
  NSI_PERMISSION_CODES,
  NSI_WRITE_PERMISSION_CODES,
} from "@/lib/nsi/permissions";

export const TSD_PERMISSION_CODES = [
  "tsd.receive",
  "tsd.putaway",
  "tsd.freePutawayScan",
  "tsd.pick",
  "tsd.transfer",
] as const;

export const MODULE_PERMISSION_CODES = [
  "module.inbound",
  "module.outbound",
  "module.inventory",
  "module.operations",
  "module.topology",
  "module.lots",
  "module.tsd",
  "module.admin",
] as const;

/** Редактирование в веб-интерфейсе по модулям (без ТСД — там отдельные tsd.*). */
export const MODULE_WRITE_PERMISSION_CODES = [
  "module.inbound.write",
  "module.outbound.write",
  "module.inventory.write",
  "module.operations.write",
  "module.topology.write",
  "module.lots.write",
  "module.admin.write",
] as const;

export const DOCUMENT_PERMISSION_CODES = [
  "document.inbound",
  "document.inbound.write",
  "document.outbound",
  "document.outbound.write",
  "document.operation",
  "document.operation.write",
] as const;

export const PERMISSION_CODES = [
  ...MODULE_PERMISSION_CODES,
  ...MODULE_WRITE_PERMISSION_CODES,
  ...DOCUMENT_PERMISSION_CODES,
  ...NSI_PERMISSION_CODES,
  ...NSI_WRITE_PERMISSION_CODES,
  ...TSD_PERMISSION_CODES,
] as const;

export type StaticPermissionCode = (typeof PERMISSION_CODES)[number];
export type PermissionCode = StaticPermissionCode | (string & {});

export type PermissionDefinition = {
  code: PermissionCode;
  title: string;
  description: string;
  group: "modules" | "documents" | "nsi" | "customUi" | "tsd";
};

type ModuleAccessDef = {
  code: (typeof MODULE_PERMISSION_CODES)[number];
  writeCode: (typeof MODULE_WRITE_PERMISSION_CODES)[number];
  title: string;
  viewDescription: string;
  writeDescription: string;
  group: PermissionDefinition["group"];
  /** @deprecated Prefer document.* permission codes for document modules. */
  deprecated?: boolean;
};

type DocumentAccessDef = {
  code: (typeof DOCUMENT_PERMISSION_CODES)[number];
  writeCode: (typeof DOCUMENT_PERMISSION_CODES)[number];
  title: string;
  viewDescription: string;
  writeDescription: string;
};

const DOCUMENT_ACCESS: DocumentAccessDef[] = [
  {
    code: "document.inbound",
    writeCode: "document.inbound.write",
    title: "Документ: приёмка",
    viewDescription: "Просмотр входящих документов",
    writeDescription: "Создание и изменение входящих документов",
  },
  {
    code: "document.outbound",
    writeCode: "document.outbound.write",
    title: "Документ: отгрузка",
    viewDescription: "Просмотр исходящих документов",
    writeDescription: "Создание и изменение исходящих документов",
  },
  {
    code: "document.operation",
    writeCode: "document.operation.write",
    title: "Документ: операции",
    viewDescription: "Просмотр журнала операций",
    writeDescription: "Создание и изменение складских операций",
  },
];

const MODULE_ACCESS: ModuleAccessDef[] = [
  {
    code: "module.inbound",
    writeCode: "module.inbound.write",
    title: "Приёмка (модуль)",
    viewDescription: "Устарело — используйте document.inbound",
    writeDescription: "Устарело — используйте document.inbound.write",
    group: "modules",
    deprecated: true,
  },
  {
    code: "module.outbound",
    writeCode: "module.outbound.write",
    title: "Отгрузка (модуль)",
    viewDescription: "Устарело — используйте document.outbound",
    writeDescription: "Устарело — используйте document.outbound.write",
    group: "modules",
    deprecated: true,
  },
  {
    code: "module.inventory",
    writeCode: "module.inventory.write",
    title: "Остатки",
    viewDescription: "Просмотр остатков и отчётов",
    writeDescription: "Корректировка остатков и экспорт",
    group: "modules",
  },
  {
    code: "module.operations",
    writeCode: "module.operations.write",
    title: "Операции (модуль)",
    viewDescription: "Устарело — используйте document.operation",
    writeDescription: "Устарело — используйте document.operation.write",
    group: "modules",
    deprecated: true,
  },
  {
    code: "module.admin",
    writeCode: "module.admin.write",
    title: "Администрирование",
    viewDescription: "Просмотр настроек, пользователей, ролей",
    writeDescription: "Изменение настроек, пользователей и ролей",
    group: "modules",
  },
  {
    code: "module.topology",
    writeCode: "module.topology.write",
    title: "Топология",
    viewDescription: "Просмотр плана склада",
    writeDescription: "Изменение плана склада",
    group: "nsi",
  },
  {
    code: "module.lots",
    writeCode: "module.lots.write",
    title: "Партии",
    viewDescription: "Просмотр партий и сроков годности",
    writeDescription: "Создание и изменение партий",
    group: "nsi",
  },
];

export const PERMISSION_REGISTRY: PermissionDefinition[] = [
  ...MODULE_ACCESS.flatMap((mod) => [
    {
      code: mod.code,
      title: mod.title,
      description: mod.viewDescription,
      group: mod.group,
    },
    {
      code: mod.writeCode,
      title: `${mod.title} — редактирование`,
      description: mod.writeDescription,
      group: mod.group,
    },
  ]),
  {
    code: NSI_HUB_PERMISSION,
    title: "Обзор НСИ",
    description: "Просмотр главной страницы раздела НСИ",
    group: "nsi",
  },
  ...NSI_CATALOG_ENTRIES.flatMap((entry) => [
    {
      code: entry.code,
      title: entry.title,
      description: entry.description,
      group: "nsi" as const,
    },
    {
      code: `${entry.code}.write` as PermissionCode,
      title: `${entry.title} — редактирование`,
      description: `Создание и изменение: ${entry.description}`,
      group: "nsi" as const,
    },
  ]),
  {
    code: "module.tsd",
    title: "Веб-интерфейс ТСД",
    description: "Доступ к приложению терминала сбора данных",
    group: "tsd",
  },
  {
    code: "tsd.receive",
    title: "ТСД: приёмка",
    description: "Приёмка по заказам на терминале",
    group: "tsd",
  },
  {
    code: "tsd.putaway",
    title: "ТСД: размещение",
    description: "Размещение принятых ТН",
    group: "tsd",
  },
  {
    code: "tsd.freePutawayScan",
    title: "ТСД: свободный скан",
    description: "Размещение вне списка задач",
    group: "tsd",
  },
  {
    code: "tsd.pick",
    title: "ТСД: отбор",
    description: "Отбор под отгрузку",
    group: "tsd",
  },
  {
    code: "tsd.transfer",
    title: "ТСД: перемещение",
    description: "Перемещение между ячейками",
    group: "tsd",
  },
];

export const PERMISSION_GROUPS = [
  { id: "modules" as const, title: "Модули" },
  { id: "documents" as const, title: "Документы" },
  { id: "nsi" as const, title: "НСИ" },
  { id: "customUi" as const, title: "Пользовательские интерфейсы" },
  { id: "tsd" as const, title: "ТСД" },
];

function permissionMessageKey(code: string, field: string) {
  return `permissions.codes.${code.replace(/\./g, "_")}.${field}`;
}

function translatePermissionField(
  code: string,
  field: string,
  fallback: string,
  locale?: AppLocale,
) {
  if (!locale) return fallback;
  return translateSyncWithFallback(
    permissionMessageKey(code, field),
    fallback,
    locale,
  );
}

export function translatePermissionGroupTitle(
  groupId: PermissionDefinition["group"],
  fallback: string,
  locale?: AppLocale,
) {
  if (!locale) return fallback;
  return translateSyncWithFallback(
    `permissions.groups.${groupId}`,
    fallback,
    locale,
  );
}

const ALL_MODULE_ACCESS = Object.fromEntries(
  MODULE_PERMISSION_CODES.map((code) => [code, true]),
) as Record<(typeof MODULE_PERMISSION_CODES)[number], boolean>;

const ALL_MODULE_WRITE = Object.fromEntries(
  MODULE_WRITE_PERMISSION_CODES.map((code) => [code, true]),
) as Record<(typeof MODULE_WRITE_PERMISSION_CODES)[number], boolean>;

const CUSTOM_MODULE_ACCESS: Record<
  (typeof MODULE_PERMISSION_CODES)[number],
  boolean
> = {
  "module.inbound": false,
  "module.outbound": false,
  "module.inventory": true,
  "module.operations": true,
  "module.topology": false,
  "module.lots": false,
  "module.tsd": false,
  "module.admin": false,
};

const ALL_MODULE_WRITE_OFF = Object.fromEntries(
  MODULE_WRITE_PERMISSION_CODES.map((code) => [code, false]),
) as Record<(typeof MODULE_WRITE_PERMISSION_CODES)[number], boolean>;

const ALL_NSI = Object.fromEntries(
  NSI_PERMISSION_CODES.map((code) => [code, true]),
) as Record<(typeof NSI_PERMISSION_CODES)[number], boolean>;

const ALL_NSI_WRITE = Object.fromEntries(
  NSI_WRITE_PERMISSION_CODES.map((code) => [code, true]),
) as Record<(typeof NSI_WRITE_PERMISSION_CODES)[number], boolean>;

const CUSTOM_ROLE_NSI: Record<(typeof NSI_PERMISSION_CODES)[number], boolean> =
  {
    "nsi.hub": true,
    "nsi.nomenclature": true,
    "nsi.counterparties": true,
    "nsi.receiving_docks": true,
    "nsi.transport_units": true,
    "nsi.zones": false,
    "nsi.cells": true,
    "nsi.pallet_types": false,
    "nsi.pallets": true,
    "nsi.packages": true,
    "nsi.units": false,
    "nsi.accounting_models": false,
    "nsi.labels": false,
  };

const CUSTOM_ROLE_NSI_WRITE = Object.fromEntries(
  NSI_WRITE_PERMISSION_CODES.map((code) => [code, false]),
) as Record<(typeof NSI_WRITE_PERMISSION_CODES)[number], boolean>;

function documentPermissionsFromModules(
  modules: Record<(typeof MODULE_PERMISSION_CODES)[number], boolean>,
  moduleWrites: Record<(typeof MODULE_WRITE_PERMISSION_CODES)[number], boolean>,
): Record<(typeof DOCUMENT_PERMISSION_CODES)[number], boolean> {
  return {
    "document.inbound": modules["module.inbound"],
    "document.inbound.write": moduleWrites["module.inbound.write"],
    "document.outbound": modules["module.outbound"],
    "document.outbound.write": moduleWrites["module.outbound.write"],
    "document.operation": modules["module.operations"],
    "document.operation.write": moduleWrites["module.operations.write"],
  };
}

function buildDefaults(input: {
  modules: Record<(typeof MODULE_PERMISSION_CODES)[number], boolean>;
  moduleWrites: Record<(typeof MODULE_WRITE_PERMISSION_CODES)[number], boolean>;
  nsi: Record<(typeof NSI_PERMISSION_CODES)[number], boolean>;
  nsiWrites: Record<(typeof NSI_WRITE_PERMISSION_CODES)[number], boolean>;
  tsd: Record<(typeof TSD_PERMISSION_CODES)[number], boolean>;
}): Record<PermissionCode, boolean> {
  return {
    ...input.modules,
    ...input.moduleWrites,
    ...documentPermissionsFromModules(input.modules, input.moduleWrites),
    ...input.nsi,
    ...input.nsiWrites,
    ...input.tsd,
  };
}

/** Дефолты для системных ролей при первом ensure. */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  string,
  Record<PermissionCode, boolean>
> = {
  admin: buildDefaults({
    modules: ALL_MODULE_ACCESS,
    moduleWrites: ALL_MODULE_WRITE,
    nsi: ALL_NSI,
    nsiWrites: ALL_NSI_WRITE,
    tsd: {
      "tsd.receive": true,
      "tsd.putaway": true,
      "tsd.freePutawayScan": true,
      "tsd.pick": true,
      "tsd.transfer": true,
    },
  }),
  operator: buildDefaults({
    modules: {
      "module.inbound": true,
      "module.outbound": true,
      "module.inventory": true,
      "module.operations": true,
      "module.topology": true,
      "module.lots": true,
      "module.tsd": true,
      "module.admin": false,
    },
    moduleWrites: {
      "module.inbound.write": true,
      "module.outbound.write": true,
      "module.inventory.write": true,
      "module.operations.write": true,
      "module.topology.write": true,
      "module.lots.write": true,
      "module.admin.write": false,
    },
    nsi: ALL_NSI,
    nsiWrites: ALL_NSI_WRITE,
    tsd: {
      "tsd.receive": true,
      "tsd.putaway": true,
      "tsd.freePutawayScan": true,
      "tsd.pick": true,
      "tsd.transfer": true,
    },
  }),
  viewer: buildDefaults({
    modules: {
      "module.inbound": true,
      "module.outbound": true,
      "module.inventory": true,
      "module.operations": true,
      "module.topology": true,
      "module.lots": true,
      "module.tsd": false,
      "module.admin": false,
    },
    moduleWrites: ALL_MODULE_WRITE_OFF,
    nsi: ALL_NSI,
    nsiWrites: CUSTOM_ROLE_NSI_WRITE,
    tsd: {
      "tsd.receive": false,
      "tsd.putaway": false,
      "tsd.freePutawayScan": false,
      "tsd.pick": false,
      "tsd.transfer": false,
    },
  }),
};

/** Дефолты для новых пользовательских ролей. */
export const DEFAULT_CUSTOM_ROLE_PERMISSIONS: Record<PermissionCode, boolean> =
  buildDefaults({
    modules: CUSTOM_MODULE_ACCESS,
    moduleWrites: ALL_MODULE_WRITE_OFF,
    nsi: CUSTOM_ROLE_NSI,
    nsiWrites: CUSTOM_ROLE_NSI_WRITE,
    tsd: {
      "tsd.receive": false,
      "tsd.putaway": false,
      "tsd.freePutawayScan": false,
      "tsd.pick": false,
      "tsd.transfer": false,
    },
  });

export function modulePermissionCode(code: ModuleCode): PermissionCode {
  return `module.${code}` as PermissionCode;
}

export function moduleWritePermissionCode(
  code: ModuleCode,
): PermissionCode | null {
  if (code === "nsi" || code === "tsd" || code === "menus") return null;
  return `module.${code}.write` as PermissionCode;
}

export function documentViewPermission(entityCode: string): PermissionCode {
  return `document.${entityCode}` as PermissionCode;
}

export function documentWritePermission(entityCode: string): PermissionCode {
  return `document.${entityCode}.write` as PermissionCode;
}

export function isStaticPermissionCode(value: string): boolean {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}

export function isPermissionCode(value: string): value is PermissionCode {
  return isStaticPermissionCode(value) || isDynamicPermissionCode(value);
}

export function viewPermissionForWriteCode(
  writeCode: PermissionCode,
): PermissionCode | null {
  if (!writeCode.endsWith(".write")) return null;
  const view = writeCode.slice(0, -".write".length);
  if (isStaticPermissionCode(view)) return view;
  return viewPermissionForDynamicWriteCode(writeCode);
}

/** Строка матрицы прав в UI ролей. */
export type PermissionMatrixRow = {
  id: string;
  title: string;
  description?: string;
  viewCode?: PermissionCode;
  writeCode?: PermissionCode;
  /** Одна колонка «доступ» (операции ТСД). */
  accessCode?: PermissionCode;
};

function moduleMatrixRows(
  group: PermissionDefinition["group"],
  locale?: AppLocale,
) {
  return MODULE_ACCESS.filter((mod) => mod.group === group).map((mod) => ({
    id: mod.code,
    title: translatePermissionField(mod.code, "title", mod.title, locale),
    description: translatePermissionField(
      mod.code,
      "viewDescription",
      mod.viewDescription,
      locale,
    ),
    viewCode: mod.code,
    writeCode: mod.writeCode,
  }));
}

function documentMatrixRows(locale?: AppLocale) {
  return DOCUMENT_ACCESS.map((doc) => ({
    id: doc.code,
    title: translatePermissionField(doc.code, "title", doc.title, locale),
    description: translatePermissionField(
      doc.code,
      "viewDescription",
      doc.viewDescription,
      locale,
    ),
    viewCode: doc.code,
    writeCode: doc.writeCode,
  }));
}

export function buildPermissionMatrixForGroup(
  groupId: PermissionDefinition["group"],
  customUi?: CustomUiPermissionContext,
  locale?: AppLocale,
): PermissionMatrixRow[] {
  if (groupId === "modules") {
    return moduleMatrixRows("modules", locale);
  }

  if (groupId === "documents") {
    return documentMatrixRows(locale);
  }

  if (groupId === "customUi") {
    return customUi ? buildCustomUiMatrixRows(customUi) : [];
  }

  if (groupId === "nsi") {
    return [
      {
        id: NSI_HUB_PERMISSION,
        title: translatePermissionField(
          NSI_HUB_PERMISSION,
          "title",
          "Обзор НСИ",
          locale,
        ),
        description: translatePermissionField(
          NSI_HUB_PERMISSION,
          "viewDescription",
          "Главная страница раздела НСИ",
          locale,
        ),
        viewCode: NSI_HUB_PERMISSION,
      },
      ...NSI_CATALOG_ENTRIES.map((entry) => ({
        id: entry.code,
        title: translatePermissionField(entry.code, "title", entry.title, locale),
        description: translatePermissionField(
          entry.code,
          "viewDescription",
          entry.description,
          locale,
        ),
        viewCode: entry.code,
        writeCode: `${entry.code}.write` as PermissionCode,
      })),
      ...moduleMatrixRows("nsi", locale),
      ...(customUi ? buildNsiCustomCatalogMatrixRows(customUi) : []),
      ...(customUi ? buildNsiCustomDocumentMatrixRows(customUi) : []),
    ];
  }

  if (groupId === "tsd") {
    return [
      {
        id: "module.tsd",
        title: translatePermissionField(
          "module.tsd",
          "title",
          "Веб-интерфейс ТСД",
          locale,
        ),
        description: translatePermissionField(
          "module.tsd",
          "viewDescription",
          "Доступ к приложению /tsd",
          locale,
        ),
        accessCode: "module.tsd",
      },
      {
        id: "tsd.receive",
        title: translatePermissionField(
          "tsd.receive",
          "title",
          "Приёмка",
          locale,
        ),
        description: translatePermissionField(
          "tsd.receive",
          "viewDescription",
          "Приёмка по заказам на терминале",
          locale,
        ),
        accessCode: "tsd.receive",
      },
      {
        id: "tsd.putaway",
        title: translatePermissionField(
          "tsd.putaway",
          "title",
          "Размещение",
          locale,
        ),
        description: translatePermissionField(
          "tsd.putaway",
          "viewDescription",
          "Размещение принятых ТН",
          locale,
        ),
        accessCode: "tsd.putaway",
      },
      {
        id: "tsd.freePutawayScan",
        title: translatePermissionField(
          "tsd.freePutawayScan",
          "title",
          "Свободный скан",
          locale,
        ),
        description: translatePermissionField(
          "tsd.freePutawayScan",
          "viewDescription",
          "Размещение вне списка задач",
          locale,
        ),
        accessCode: "tsd.freePutawayScan",
      },
      {
        id: "tsd.pick",
        title: translatePermissionField("tsd.pick", "title", "Отбор", locale),
        description: translatePermissionField(
          "tsd.pick",
          "viewDescription",
          "Отбор под отгрузку",
          locale,
        ),
        accessCode: "tsd.pick",
      },
      {
        id: "tsd.transfer",
        title: translatePermissionField(
          "tsd.transfer",
          "title",
          "Перемещение",
          locale,
        ),
        description: translatePermissionField(
          "tsd.transfer",
          "viewDescription",
          "Перемещение между ячейками",
          locale,
        ),
        accessCode: "tsd.transfer",
      },
    ];
  }

  return [];
}
