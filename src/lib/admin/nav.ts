export type AdminTab = {
  href: string;
  label: string;
  labelKey?: string;
};

export const ADMIN_HUB = "/admin";

export const ADMIN_TABS: AdminTab[] = [
  { href: ADMIN_HUB, label: "Обзор", labelKey: "tabs.overview" },
  { href: "/settings", label: "Настройки", labelKey: "tabs.settings" },
  { href: "/admin/users", label: "Пользователи", labelKey: "tabs.users" },
  { href: "/admin/roles", label: "Роли", labelKey: "tabs.roles" },
  { href: "/admin/statuses", label: "Статусы", labelKey: "tabs.statuses" },
  { href: "/admin/meta", label: "Метаданные", labelKey: "tabs.meta" },
  { href: "/admin/nav", label: "Меню", labelKey: "tabs.nav" },
  {
    href: "/admin/integration",
    label: "Интеграция",
    labelKey: "tabs.integration",
  },
  {
    href: "/admin/putaway",
    label: "Размещение",
    labelKey: "tabs.putaway",
  },
];

export type AdminHubCard = {
  href: string;
  title: string;
  hint: string;
  titleKey?: string;
  hintKey?: string;
};

export const ADMIN_HUB_CARDS: AdminHubCard[] = [
  {
    href: "/settings",
    title: "Настройки",
    hint: "Склад, модули, ТСД",
    titleKey: "cards.settings.title",
    hintKey: "cards.settings.hint",
  },
  {
    href: "/admin/users",
    title: "Пользователи",
    hint: "Учётные записи и роли",
    titleKey: "cards.users.title",
    hintKey: "cards.users.hint",
  },
  {
    href: "/admin/roles",
    title: "Роли",
    hint: "Права доступа",
    titleKey: "cards.roles.title",
    hintKey: "cards.roles.hint",
  },
  {
    href: "/admin/statuses",
    title: "Статусы",
    hint: "Жизненный цикл документов",
    titleKey: "cards.statuses.title",
    hintKey: "cards.statuses.hint",
  },
  {
    href: "/admin/meta",
    title: "Метаданные",
    hint: "Справочники и поля",
    titleKey: "cards.meta.title",
    hintKey: "cards.meta.hint",
  },
  {
    href: "/admin/nav",
    title: "Меню",
    hint: "Пункты и иконки левого меню",
    titleKey: "cards.nav.title",
    hintKey: "cards.nav.hint",
  },
  {
    href: "/admin/integration",
    title: "Интеграция",
    hint: "Обмен с 1С и вебхуки",
    titleKey: "cards.integration.title",
    hintKey: "cards.integration.hint",
  },
  {
    href: "/admin/putaway",
    title: "Правила размещения",
    hint: "Правила и поведение на ТСД",
    titleKey: "cards.putaway.title",
    hintKey: "cards.putaway.hint",
  },
];

export function translateAdminTab(
  tab: AdminTab,
  t: (key: string) => string,
) {
  return tab.labelKey ? t(tab.labelKey) : tab.label;
}

export function translateAdminHubCard(
  card: AdminHubCard,
  t: (key: string) => string,
) {
  return {
    title: card.titleKey ? t(card.titleKey) : card.title,
    hint: card.hintKey ? t(card.hintKey) : card.hint,
  };
}

export function adminTabActive(pathname: string, href: string) {
  if (href === ADMIN_HUB) {
    return pathname === ADMIN_HUB;
  }
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  return false;
}
