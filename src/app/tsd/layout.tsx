import Link from "next/link";
import { DisableBrowserCache } from "@/components/disable-browser-cache";
import { logoutAction } from "@/lib/auth-actions";
import { requireModule } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TsdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("tsd");

  return (
    <div className="min-h-full bg-[var(--surface)] text-[var(--ink)]">
      <DisableBrowserCache />
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Link href="/tsd" className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              ТСД
            </p>
            <p className="truncate text-sm font-semibold">Складской терминал</p>
          </Link>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <Link
              href="/tsd"
              className="text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Меню
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-[var(--accent)] hover:underline"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="px-4 py-5">{children}</main>
    </div>
  );
}
