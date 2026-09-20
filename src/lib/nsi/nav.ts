import type { PermissionCode } from "@/lib/permissions/registry";
import { filterByNsiPermissions } from "@/lib/nsi/permissions";

export type NsiTab = {
  href: string;
  label: string;
  labelKey?: string;
  entityCode?: string;
  requiresTopology?: boolean;
  requiresLots?: boolean;
};

import { NSI_HUB } from "@/lib/nsi/tab-active";

export const NSI_TABS: NsiTab[] = [
  { href: NSI_HUB, label: "Обзор", labelKey: "tabs.overview" },
  {
    href: "/catalog/nomenclature",
    label: "Номенклатура",
    labelKey: "tabs.nomenclature",
    entityCode: "nomenclature",
  },
  {
    href: "/catalog/counterparties",
    label: "Контрагенты",
    labelKey: "tabs.counterparties",
    entityCode: "counterparties",
  },
  {
    href: "/catalog/receiving_docks",
    label: "Рампы",
    labelKey: "tabs.receivingDocks",
    entityCode: "receiving_docks",
  },
  {
    href: "/catalog/transport_units",
    label: "Транспорт",
    labelKey: "tabs.transportUnits",
    entityCode: "transport_units",
  },
  {
    href: "/catalog/zones",
    label: "Зоны",
    labelKey: "tabs.zones",
    entityCode: "zones",
  },
  {
    href: "/catalog/cells",
    label: "Ячейки",
    labelKey: "tabs.cells",
    entityCode: "cells",
  },
  {
    href: "/catalog/pallet_types",
    label: "Типы ТН",
    labelKey: "tabs.palletTypes",
    entityCode: "pallet_types",
  },
  {
    href: "/catalog/pallets",
    label: "ТН",
    labelKey: "tabs.pallets",
    entityCode: "pallets",
  },
  {
    href: "/catalog/packages",
    label: "Упаковки",
    labelKey: "tabs.packages",
    entityCode: "packages",
  },
  {
    href: "/catalog/units",
    label: "Единицы",
    labelKey: "tabs.units",
    entityCode: "units",
  },
  {
    href: "/catalog/accounting_models",
    label: "Модели учёта",
    labelKey: "tabs.accountingModels",
    entityCode: "accounting_models",
  },
  {
    href: "/labels",
    label: "Штрихкоды",
    labelKey: "tabs.labels",
    entityCode: "labels",
  },
  {
    href: "/topology",
    label: "Топология",
    labelKey: "tabs.topology",
    requiresTopology: true,
  },
  {
    href: "/lots",
    label: "Партии",
    labelKey: "tabs.lots",
    requiresLots: true,
  },
];

export type NsiHubCard = {
  href: string;
  title: string;
  hint: string;
  titleKey?: string;
  hintKey?: string;
  key: string;
  entityCode?: string;
  requiresTopology?: boolean;
  requiresLots?: boolean;
};

export const NSI_HUB_CARDS: NsiHubCard[] = [
  {
    href: "/catalog/nomenclature",
    title: "Номенклатура",
    hint: "SKU, единица, упаковки",
    titleKey: "cards.nomenclature.title",
    hintKey: "cards.nomenclature.hint",
    key: "products",
    entityCode: "nomenclature",
  },
  {
    href: "/catalog/counterparties",
    title: "Контрагенты",
    hint: "Поставщики и клиенты",
    titleKey: "cards.counterparties.title",
    hintKey: "cards.counterparties.hint",
    key: "counterparties",
    entityCode: "counterparties",
  },
  {
    href: "/catalog/receiving_docks",
    title: "Рампы",
    hint: "Приёмка и отгрузка",
    titleKey: "cards.receivingDocks.title",
    hintKey: "cards.receivingDocks.hint",
    key: "receivingDocks",
    entityCode: "receiving_docks",
  },
  {
    href: "/catalog/transport_units",
    title: "Транспорт",
    hint: "ТС и водители",
    titleKey: "cards.transportUnits.title",
    hintKey: "cards.transportUnits.hint",
    key: "transportUnits",
    entityCode: "transport_units",
  },
  {
    href: "/catalog/zones",
    title: "Зоны",
    hint: "Зоны склада",
    titleKey: "cards.zones.title",
    hintKey: "cards.zones.hint",
    key: "zones",
    entityCode: "zones",
  },
  {
    href: "/catalog/cells",
    title: "Ячейки",
    hint: "Адресное хранение",
    titleKey: "cards.cells.title",
    hintKey: "cards.cells.hint",
    key: "cells",
    entityCode: "cells",
  },
  {
    href: "/catalog/pallet_types",
    title: "Типы ТН",
    hint: "EUR и др. типы носителей",
    titleKey: "cards.palletTypes.title",
    hintKey: "cards.palletTypes.hint",
    key: "palletTypes",
    entityCode: "pallet_types",
  },
  {
    href: "/catalog/pallets",
    title: "ТН",
    hint: "Паллеты и др. ТН",
    titleKey: "cards.pallets.title",
    hintKey: "cards.pallets.hint",
    key: "pallets",
    entityCode: "pallets",
  },
  {
    href: "/catalog/packages",
    title: "Упаковки",
    hint: "Коэффициент, ШК и ВГХ",
    titleKey: "cards.packages.title",
    hintKey: "cards.packages.hint",
    key: "packages",
    entityCode: "packages",
  },
  {
    href: "/catalog/units",
    title: "Базовые единицы",
    hint: "шт, кг, л…",
    titleKey: "cards.units.title",
    hintKey: "cards.units.hint",
    key: "units",
    entityCode: "units",
  },
  {
    href: "/catalog/accounting_models",
    title: "Модели учёта",
    hint: "Схемы учёта остатков",
    titleKey: "cards.accountingModels.title",
    hintKey: "cards.accountingModels.hint",
    key: "accountingModels",
    entityCode: "accounting_models",
  },
  {
    href: "/labels",
    title: "Штрихкоды",
    hint: "Справочник и печать по выбору",
    titleKey: "cards.labels.title",
    hintKey: "cards.labels.hint",
    key: "labels",
    entityCode: "labels",
  },
  {
    href: "/topology",
    title: "Топология",
    hint: "План склада и размещение ячеек",
    titleKey: "cards.topology.title",
    hintKey: "cards.topology.hint",
    key: "topology",
    requiresTopology: true,
  },
  {
    href: "/lots",
    title: "Партии",
    hint: "Партии и сроки годности",
    titleKey: "cards.lots.title",
    hintKey: "cards.lots.hint",
    key: "lots",
    requiresLots: true,
  },
];

export function translateNsiTab(
  tab: NsiTab,
  t: (key: string) => string,
) {
  return tab.labelKey ? t(tab.labelKey) : tab.label;
}

export function translateNsiHubCard(
  card: NsiHubCard,
  t: (key: string) => string,
) {
  return {
    title: card.titleKey ? t(card.titleKey) : card.title,
    hint: card.hintKey ? t(card.hintKey) : card.hint,
  };
}

export function filterNsiTabs(input: {
  topology: boolean;
  lots: boolean;
  allowedTopology?: boolean;
  allowedLots?: boolean;
  permissions?: ReadonlySet<PermissionCode>;
}) {
  let tabs = NSI_TABS.filter((tab) => {
    if (tab.requiresTopology && (!input.topology || input.allowedTopology === false)) {
      return false;
    }
    if (tab.requiresLots && (!input.lots || input.allowedLots === false)) {
      return false;
    }
    return true;
  });
  if (input.permissions) {
    tabs = filterByNsiPermissions(tabs, input.permissions);
  }
  return tabs;
}

export function filterNsiHubCards(input: {
  topology: boolean;
  lots: boolean;
  allowedTopology?: boolean;
  allowedLots?: boolean;
  permissions?: ReadonlySet<PermissionCode>;
}) {
  let cards = NSI_HUB_CARDS.filter((card) => {
    if (card.requiresTopology && (!input.topology || input.allowedTopology === false)) {
      return false;
    }
    if (card.requiresLots && (!input.lots || input.allowedLots === false)) {
      return false;
    }
    return true;
  });
  if (input.permissions) {
    cards = filterByNsiPermissions(cards, input.permissions);
  }
  return cards;
}

export { nsiTabActive } from "@/lib/nsi/tab-active";
