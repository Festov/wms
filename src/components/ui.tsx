"use client";

import { DisableBrowserCache } from "@/components/disable-browser-cache";
import { Icon } from "@/components/icons";
import { logoutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/format";
import { statusLabelFallback } from "@/lib/status/labels";
import { resolveStatusAppearance } from "@/lib/status/appearance";
import { useStatusCatalog } from "@/components/status-styles-provider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useEffectEvent, Children, type KeyboardEvent } from "react";

function LogoutButton() {
  const t = useTranslations("common");
  return (
    <form action={logoutAction} className="mt-2">
      <button type="submit" className="text-[var(--accent)] hover:underline">
        {t("logout")}
      </button>
    </form>
  );
}

export type NavLink = {
  href: string;
  label: string;
  group?: string;
  iconKey?: string;
  /** Открыть в новой вкладке (отдельное приложение) */
  openInNewTab?: boolean;
  /** Дополнительные префиксы пути для подсветки пункта */
  activePrefixes?: string[];
};

const LAYOUT_KEY = "wms.sidebar.layout";

type SidebarLayout = "list" | "stack";

function navLinkActive(pathname: string, link: NavLink) {
  if (link.openInNewTab) return pathname === link.href;
  const prefixes = [link.href, ...(link.activePrefixes ?? [])];
  for (const href of prefixes) {
    if (pathname === href) return true;
    if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  }
  return false;
}

export function AppShell({
  children,
  links,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  links: NavLink[];
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const tSidebar = useTranslations("sidebar");
  const [layout, setLayout] = useState<SidebarLayout>("stack");
  const [ready, setReady] = useState(false);

  const hydrate = useEffectEvent(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_KEY);
      if (stored === "list" || stored === "stack") {
        setLayout(stored);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  });

  useEffect(() => {
    hydrate();
  }, []);

  function toggleLayout() {
    setLayout((prev) => {
      const next: SidebarLayout = prev === "list" ? "stack" : "list";
      try {
        localStorage.setItem(LAYOUT_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const stackMode = layout === "stack";
  const asideWidth = stackMode ? "w-32 px-2" : "w-60 px-3";

  const isLogin = pathname === "/login";
  const isTsd = pathname === "/tsd" || pathname.startsWith("/tsd/");
  if (isLogin || isTsd) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-full bg-[var(--surface)] text-[var(--ink)]">
      <DisableBrowserCache />
      <div className="flex min-h-full w-full">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-[var(--line)] bg-[var(--panel)] py-4 transition-[width] duration-200 lg:flex",
            ready ? asideWidth : "w-32 px-2",
          )}
        >
          <nav
            className={cn(
              "flex flex-1 flex-col",
              stackMode ? "gap-1" : "gap-0.5",
            )}
          >
            {links.map((link) => {
              const active =
                !link.openInNewTab && navLinkActive(pathname, link);
              const iconClass = stackMode ? "size-7" : "size-4";

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  target={link.openInNewTab ? "_blank" : undefined}
                  rel={
                    link.openInNewTab ? "noopener noreferrer" : undefined
                  }
                  className={cn(
                    "rounded-lg transition",
                    layout === "list" &&
                      "flex items-center gap-2.5 px-2.5 py-1.5 text-sm",
                    stackMode &&
                      "flex flex-col items-center gap-1.5 px-1.5 py-2.5 text-center",
                    active
                      ? "bg-[var(--surface)] font-medium text-[var(--ink)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
                  )}
                >
                  <Icon
                    name={link.iconKey ?? "grid"}
                    className={iconClass}
                  />
                  {layout === "list" ? <span>{link.label}</span> : null}
                  {stackMode ? (
                    <span className="w-full text-xs font-medium leading-snug [overflow-wrap:anywhere]">
                      {link.label}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-[var(--line)] px-1 pt-3">
            <div
              className={cn(
                "flex gap-2",
                stackMode ? "flex-col items-center" : "items-start justify-between",
              )}
            >
              {(userName || userEmail) ? (
                <div
                  className={cn(
                    "min-w-0 text-xs text-[var(--muted)]",
                    stackMode ? "w-full text-center" : "flex-1",
                  )}
                >
                  {userName ? (
                    <p
                      className={cn(
                        "font-medium text-[var(--ink)]",
                        stackMode && "text-xs leading-snug [overflow-wrap:anywhere]",
                      )}
                    >
                      {userName}
                    </p>
                  ) : null}
                  {!stackMode && userEmail ? (
                    <p className="truncate">{userEmail}</p>
                  ) : null}
                  {!stackMode ? <LogoutButton /> : null}
                </div>
              ) : (
                !stackMode ? <div className="flex-1" /> : null
              )}
              <button
                type="button"
                onClick={toggleLayout}
                className={cn(
                  "shrink-0 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]",
                  stackMode && "mx-auto",
                )}
                title={
                  layout === "stack"
                    ? tSidebar("layoutToggleToList")
                    : tSidebar("layoutToggleToStack")
                }
              >
                <Icon name={layout === "stack" ? "menu" : "grid"} />
              </button>
              {stackMode ? (
                <form action={logoutAction} className="w-full">
                  <button
                    type="submit"
                    className="w-full text-xs text-[var(--accent)] hover:underline"
                  >
                    {t("logout")}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur lg:hidden">
            <div className="overflow-x-auto px-4 py-3">
              <nav className="flex gap-2 whitespace-nowrap">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    target={link.openInNewTab ? "_blank" : undefined}
                    rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)]"
                  >
                    <Icon name={link.iconKey ?? "grid"} className="size-3.5" />
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Стандартная оболочка страницы приложения.
 *
 * @example Список документов
 * ```tsx
 * return (
 *   <Page>
 *     <PageHeader title="…" description="…" actions={<Link …>Создать</Link>} />
 *     <Panel flush><DataTable … /></Panel>
 *   </Page>
 * );
 * ```
 *
 * @example Хаб с карточками
 * ```tsx
 * return (
 *   <Page>
 *     <PageHeader title="…" description="…" />
 *     <PageGrid cols={4}>{cards}</PageGrid>
 *   </Page>
 * );
 * ```
 */
export function Page({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  /** Узкая колонка по центру (формы, экраны ТСД) */
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        narrow && "mx-auto w-full max-w-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Сетка карточек: хабы (4 колонки) или метрики обзора (3 колонки). */
export function PageGrid({
  children,
  className,
  cols = 4,
}: {
  children: React.ReactNode;
  className?: string;
  cols?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        cols === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type OverviewMetric = {
  label: string;
  value: number | string;
  hint: string;
  href?: string;
};

/** Блок обзора: заголовок потока + две метрики в одной строке. */
export function OverviewFlowSection({
  title,
  href,
  metrics,
}: {
  title: string;
  href: string;
  metrics: OverviewMetric[];
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold tracking-tight">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href ?? href}>
            <Panel className="h-full transition hover:border-[var(--accent)]">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{metric.hint}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-snug text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 overflow-x-auto sm:w-auto sm:overflow-visible">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function Panel({
  children,
  className,
  title,
  sectionLabel,
  flush,
  actions,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** @deprecated Prefer sectionLabel for settings-style section headers */
  title?: string;
  sectionLabel?: string;
  flush?: boolean;
  actions?: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-[var(--line)] bg-[var(--panel)]",
        className,
      )}
    >
      {sectionLabel ? (
        <p className="border-b border-[var(--line)] bg-[var(--surface)]/70 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          {sectionLabel}
        </p>
      ) : title ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function DataTable({
  headers,
  children,
  empty,
  colWidths,
  stickyFirstColumn,
  tableMinWidth,
  layout,
}: {
  headers: Array<
    string | { label: React.ReactNode; className?: string; title?: string }
  >;
  children: React.ReactNode;
  empty?: string | boolean;
  /** Ширины колонок, например `["20%", "4.5rem", …]`. По умолчанию включает `table-fixed`. */
  colWidths?: string[];
  /** Первый столбец остаётся видимым при горизонтальной прокрутке. */
  stickyFirstColumn?: boolean;
  /** Минимальная ширина таблицы (удобно для широких матриц). */
  tableMinWidth?: string;
  /** `auto` — колонки не сжимаются ниже colWidths, таблица может быть шире контейнера. */
  layout?: "fixed" | "auto";
}) {
  const tUi = useTranslations("components.ui");
  const hasRows = Children.count(children) > 0;
  const fixedLayout = layout ? layout === "fixed" : Boolean(colWidths?.length);
  const emptyMessage = empty === true ? tUi("dataTableEmpty") : empty;

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table
        className={cn(
          "text-left text-sm [&_td]:text-sm",
          fixedLayout ? "w-full min-w-full table-fixed" : "w-max min-w-full",
          stickyFirstColumn &&
            "[&_thead_th:first-child]:sticky [&_thead_th:first-child]:left-0 [&_thead_th:first-child]:z-20 [&_thead_th:first-child]:bg-[var(--surface)] [&_tbody_td:first-child]:sticky [&_tbody_td:first-child]:left-0 [&_tbody_td:first-child]:z-10 [&_tbody_td:first-child]:bg-[var(--panel)] [&_td:first-child]:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]",
        )}
        style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
      >
        {colWidths?.length ? (
          <colgroup>
            {colWidths.map((width, index) => (
              <col key={`col-${index}`} style={{ width }} />
            ))}
          </colgroup>
        ) : null}
        <thead className="bg-[var(--surface)]/70">
          <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            {headers.map((header, index) => {
              const label = typeof header === "string" ? header : header.label;
              const className =
                typeof header === "string" ? undefined : header.className;
              const title =
                typeof header === "string" ? undefined : header.title;
              return (
                <th
                  key={typeof header === "string" ? header || `col-${index}` : `col-${index}`}
                  title={title}
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 font-medium",
                    title && "cursor-help",
                    className,
                  )}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">{children}</tbody>
      </table>
      {emptyMessage && !hasRows ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">{emptyMessage}</p>
      ) : null}
    </div>
  );
}

/** Строка таблицы с переходом по клику на всю область (overlay на tr в таблицах ненадёжен). */
export function ClickableTableRow({
  href,
  label,
  children,
  className,
}: {
  href?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    if (href) router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (!href) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      go();
    }
  }

  return (
    <tr
      className={cn("hover:bg-[var(--surface)]/60", href && "cursor-pointer", className)}
      onClick={href ? go : undefined}
      onKeyDown={onKeyDown}
      tabIndex={href ? 0 : undefined}
      role={href ? "link" : undefined}
      aria-label={href ? label : undefined}
    >
      {children}
    </tr>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1 text-sm", className)}>
      <span className="text-xs text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function StatusBadge({
  status,
  title,
  className,
  label,
}: {
  status: string;
  title?: string;
  className?: string;
  /** Переопределить подпись (иначе из каталога / fallback). */
  label?: string;
}) {
  const catalog = useStatusCatalog();
  const fromCatalog = catalog[status];
  const appearance = fromCatalog
    ? fromCatalog
    : resolveStatusAppearance(status);

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{
        background: appearance.bg,
        color: appearance.fg,
        border: `1px solid ${appearance.border}`,
      }}
    >
      {label ?? appearance.name ?? statusLabelFallback(status)}
    </span>
  );
}

export const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-sans text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export const inputCompactClass =
  "h-[2.375rem] w-full rounded-lg border border-[var(--line)] bg-white px-3 font-sans text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export const buttonClass =
  "inline-flex h-[2.375rem] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-3.5 font-sans text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonCompactClass =
  "inline-flex h-[2.375rem] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent)] px-3.5 font-sans text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonSecondaryClass =
  "inline-flex h-[2.375rem] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-white px-3.5 font-sans text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonSecondaryCompactClass =
  "inline-flex h-[2.375rem] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-white px-3.5 font-sans text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonDangerCompactClass =
  "inline-flex h-[2.375rem] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-rose-200 bg-white px-3.5 font-sans text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";
