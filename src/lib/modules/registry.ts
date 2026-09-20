import { localized } from "@/lib/i18n/errors";

export type RoleCode = string;

export const SYSTEM_ROLE_CODES = ["admin"] as const;

export type ModuleCode =
  | "nsi"
  | "inbound"
  | "outbound"
  | "inventory"
  | "operations"
  | "topology"
  | "lots"
  | "menus"
  | "tsd"
  | "admin";

export type ModuleSettingsFlag =
  | "moduleInbound"
  | "moduleOutbound"
  | "moduleTopology"
  | "moduleLots"
  | "moduleMenus"
  | "moduleOperations"
  | "moduleTsd";

export type ModuleDefinition = {
  code: ModuleCode;
  title: string;
  navGroup: string;
  navOrder: number;
  iconKey: string;
  /** Always enabled regardless of Settings flags */
  alwaysOn?: boolean;
  settingsFlag?: ModuleSettingsFlag;
  /** Path prefixes that require this module */
  routePrefixes: string[];
  apiPrefixes: string[];
};

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    code: "nsi",
    title: "НСИ",
    navGroup: "НСИ",
    navOrder: 10,
    iconKey: "book",
    alwaysOn: true,
    routePrefixes: ["/nsi", "/catalog", "/labels", "/lots"],
    apiPrefixes: [],
  },
  {
    code: "menus",
    title: "Пользовательские интерфейсы",
    navGroup: "НСИ",
    navOrder: 11,
    iconKey: "grid",
    settingsFlag: "moduleMenus",
    routePrefixes: ["/m", "/doc"],
    apiPrefixes: [],
  },
  {
    code: "inbound",
    title: "Приёмка",
    navGroup: "Входящий поток",
    navOrder: 20,
    iconKey: "inbox",
    settingsFlag: "moduleInbound",
    routePrefixes: ["/inbound", "/doc/inbound"],
    apiPrefixes: ["/api/tsd/receive", "/api/tsd/orders", "/api/tsd/putaway"],
  },
  {
    code: "outbound",
    title: "Отгрузка",
    navGroup: "Исходящий поток",
    navOrder: 30,
    iconKey: "outbox",
    settingsFlag: "moduleOutbound",
    routePrefixes: ["/outbound", "/doc/outbound"],
    apiPrefixes: ["/api/tsd/pick"],
  },
  {
    code: "inventory",
    title: "Остатки",
    navGroup: "Склад",
    navOrder: 15,
    iconKey: "layers",
    alwaysOn: true,
    routePrefixes: ["/inventory"],
    apiPrefixes: ["/api/inventory"],
  },
  {
    code: "operations",
    title: "Операции",
    navGroup: "Склад",
    navOrder: 16,
    iconKey: "layers",
    settingsFlag: "moduleOperations",
    routePrefixes: ["/operations", "/doc/operation"],
    apiPrefixes: [],
  },
  {
    code: "topology",
    title: "Топология",
    navGroup: "НСИ",
    navOrder: 12,
    iconKey: "map",
    settingsFlag: "moduleTopology",
    routePrefixes: ["/topology"],
    apiPrefixes: ["/api/tsd/transfer"],
  },
  {
    code: "lots",
    title: "Партии",
    navGroup: "НСИ",
    navOrder: 14,
    iconKey: "layers",
    settingsFlag: "moduleLots",
    routePrefixes: ["/lots"],
    apiPrefixes: [],
  },
  {
    code: "tsd",
    title: "ТСД",
    navGroup: "Приложение",
    navOrder: 95,
    iconKey: "scan",
    settingsFlag: "moduleTsd",
    routePrefixes: ["/tsd"],
    apiPrefixes: ["/api/tsd"],
  },
  {
    code: "admin",
    title: "Администрирование",
    navGroup: "Система",
    navOrder: 90,
    iconKey: "settings",
    alwaysOn: true,
    routePrefixes: ["/admin", "/settings"],
    apiPrefixes: ["/api/integration"],
  },
];

export const NAV_GROUP_ORDER = [
  "Склад",
  "Входящий поток",
  "Исходящий поток",
  "НСИ",
  "Система",
  "Приложение",
] as const;

export function getModule(code: ModuleCode) {
  const mod = MODULE_REGISTRY.find((m) => m.code === code);
  if (!mod) throw new Error(localized("errors.modules.unknown", "ru", { code }));
  return mod;
}

export function moduleForPath(pathname: string): ModuleDefinition | null {
  const sorted = [...MODULE_REGISTRY].sort(
    (a, b) =>
      Math.max(...b.routePrefixes.map((p) => p.length), 0) -
      Math.max(...a.routePrefixes.map((p) => p.length), 0),
  );
  for (const mod of sorted) {
    if (mod.routePrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return mod;
    }
  }
  return null;
}

export function moduleForApiPath(pathname: string): ModuleDefinition | null {
  const sorted = [...MODULE_REGISTRY].sort(
    (a, b) =>
      Math.max(...b.apiPrefixes.map((p) => p.length), 0) -
      Math.max(...a.apiPrefixes.map((p) => p.length), 0),
  );
  for (const mod of sorted) {
    if (mod.apiPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return mod;
    }
  }
  return null;
}

export type ModuleFlags = {
  inbound: boolean;
  outbound: boolean;
  inventory: boolean;
  operations: boolean;
  topology: boolean;
  lots: boolean;
  menus: boolean;
  tsd: boolean;
};

export function isModuleEnabled(
  mod: ModuleDefinition,
  flags: ModuleFlags,
): boolean {
  if (mod.alwaysOn) return true;
  switch (mod.settingsFlag) {
    case "moduleInbound":
      return flags.inbound;
    case "moduleOutbound":
      return flags.outbound;
    case "moduleTopology":
      return flags.topology;
    case "moduleLots":
      return flags.lots;
    case "moduleMenus":
      return flags.menus;
    case "moduleOperations":
      return flags.operations;
    case "moduleTsd":
      return flags.tsd;
    default:
      return false;
  }
}

export function getToggleableModules() {
  return MODULE_REGISTRY.filter((m) => m.settingsFlag && !m.alwaysOn);
}

export function getAlwaysOnModules() {
  return MODULE_REGISTRY.filter((m) => m.alwaysOn && m.code !== "admin");
}
