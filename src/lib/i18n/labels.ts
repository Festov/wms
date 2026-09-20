import type { ModuleCode } from "@/lib/modules/registry";

const NAV_GROUP_KEYS: Record<string, string> = {
  Склад: "navGroups.warehouse",
  "Входящий поток": "navGroups.inboundFlow",
  "Исходящий поток": "navGroups.outboundFlow",
  НСИ: "navGroups.nsi",
  Система: "navGroups.system",
  Приложение: "navGroups.app",
};

const SIDEBAR_KEY_TO_MESSAGE: Record<string, string> = {
  "/": "sidebar.overview",
  nsi: "sidebar.nsi",
  inbound: "sidebar.inbound",
  outbound: "sidebar.outbound",
  control: "sidebar.inventory",
  operations: "sidebar.operations",
  admin: "sidebar.admin",
  tsd: "sidebar.tsd",
};

export function translateNavGroup(
  group: string,
  t: (key: string) => string,
): string {
  const key = NAV_GROUP_KEYS[group];
  return key ? t(key) : group;
}

export function translateModuleTitle(
  code: ModuleCode,
  t: (key: string) => string,
): string {
  return t(`modules.${code}`);
}

export function translateSidebarKey(
  key: string,
  t: (key: string) => string,
): string {
  const messageKey = SIDEBAR_KEY_TO_MESSAGE[key];
  return messageKey ? t(messageKey) : key;
}
