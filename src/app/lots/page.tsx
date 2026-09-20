import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ClickableTableRow,
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonSecondaryClass,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireModule } from "@/lib/session";

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  await requireModule("lots");
  const sp = await searchParams;
  const productId = sp.productId?.trim() ?? "";
  const t = await getTranslations("pages.lots");
  const tc = await getTranslations("pages.common");

  const [lots, filteredProduct] = await Promise.all([
    prisma.lot.findMany({
      where: productId ? { productId } : undefined,
      orderBy: [{ expiryDate: "asc" }, { number: "asc" }],
      include: {
        product: true,
        balances: {
          include: { location: true },
        },
      },
    }),
    productId
      ? prisma.product.findUnique({ where: { id: productId } })
      : Promise.resolve(null),
  ]);

  const description = filteredProduct
    ? t("descriptionFiltered", {
        sku: filteredProduct.sku,
        name: filteredProduct.name,
      })
    : t("description");

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={description}
        actions={
          <>
            {productId ? (
              <Link
                href={`/catalog/nomenclature/${productId}`}
                className={buttonSecondaryClass}
              >
                {tc("product")}
              </Link>
            ) : (
              <Link href="/catalog/nomenclature" className={buttonSecondaryClass}>
                {tc("nomenclature")}
              </Link>
            )}
            <Link
              href={
                productId
                  ? `/lots/new?productId=${productId}&returnTo=/lots?productId=${productId}`
                  : "/lots/new"
              }
              className={buttonClass}
            >
              {tc("create")}
            </Link>
          </>
        }
      />

      {productId ? (
        <p className="mb-4 text-sm text-[var(--muted)]">
          <Link href="/lots" className="underline hover:text-[var(--text)]">
            {tc("showAllLots")}
          </Link>
        </p>
      ) : null}

      <Panel flush>
        <DataTable
          headers={[
            t("lot"),
            t("product"),
            t("expiry"),
            t("manufactured"),
            t("balance"),
            t("locations"),
          ]}
          empty={lots.length === 0 ? t("empty") : undefined}
        >
          {lots.map((lot) => {
            const qty = lot.balances.reduce((s, b) => s + b.quantity, 0);
            const cells = lot.balances
              .filter((b) => b.quantity !== 0)
              .map((b) => `${b.location.code}:${b.quantity}`)
              .join(", ");
            return (
              <ClickableTableRow
                key={lot.id}
                href={`/lots/${lot.id}`}
                label={tc("openLot", { number: lot.number })}
              >
                <td className="px-3 py-2 font-medium">{lot.number}</td>
                <td className="px-3 py-2">
                  {lot.product.sku} {lot.product.name}
                </td>
                <td className="px-3 py-2">
                  {lot.expiryDate
                    ? formatDate(lot.expiryDate).slice(0, 10)
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {lot.manufacturedAt
                    ? formatDate(lot.manufacturedAt).slice(0, 10)
                    : "—"}
                </td>
                <td className="px-3 py-2 font-medium">{qty}</td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {cells || "—"}
                </td>
              </ClickableTableRow>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
