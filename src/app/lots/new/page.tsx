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
import { CreateableSelect } from "@/components/createable-select";
import { safeReturnTo } from "@/lib/create-href";
import { createLot } from "@/lib/module-actions";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";

export default async function NewLotPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; productId?: string }>;
}) {
  await requireModule("lots");
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo, "/lots");
  const presetProductId = String(params.productId ?? "").trim();
  const t = await getTranslations("pages.lots");
  const tc = await getTranslations("pages.common");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { sku: "asc" },
  });

  return (
    <Page>
      <PageHeader
        title={t("newTitle")}
        actions={
          <Link href={returnTo} className={buttonSecondaryClass}>
            {tc("back")}
          </Link>
        }
      />

      <Panel title={tc("details")}>
        <form action={createLot} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field label={`${tc("product")} *`}>
            <CreateableSelect
              name="productId"
              required
              defaultValue={presetProductId}
              createKind="nomenclature"
              createLabel={tc("createNomenclature")}
              options={products.map((p) => ({
                id: p.id,
                label: `${p.sku} · ${p.name}`,
              }))}
            />
          </Field>
          <Field label={t("lotNumber")}>
            <input className={inputClass} name="number" required autoFocus />
          </Field>
          <Field label={t("expiryDate")}>
            <input className={inputClass} name="expiryDate" type="date" />
          </Field>
          <Field label={t("manufacturedAt")}>
            <input className={inputClass} name="manufacturedAt" type="date" />
          </Field>
          <div className="md:col-span-2">
            <button className={buttonClass} type="submit">
              {tc("create")}
            </button>
          </div>
        </form>
      </Panel>
    </Page>
  );
}
