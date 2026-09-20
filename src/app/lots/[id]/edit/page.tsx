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
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { updateLot } from "@/lib/module-actions";
import { requireModule } from "@/lib/session";
import { notFound } from "next/navigation";

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return formatDate(value).slice(0, 10);
}

export default async function EditLotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("lots");
  const { id } = await params;
  const t = await getTranslations("pages.lots");
  const tc = await getTranslations("pages.common");
  const tSave = await getTranslations("common");

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!lot) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateLot(id, formData);
  }

  return (
    <Page>
      <PageHeader
        title={tc("editTitle", { name: lot.number })}
        description={`${lot.product.sku} · ${lot.product.name}`}
        actions={
          <Link href={`/lots/${id}`} className={buttonSecondaryClass}>
            {tc("back")}
          </Link>
        }
      />

      <Panel title={tc("details")}>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <Field label={tc("product")}>
            <input
              className={inputClass}
              readOnly
              value={`${lot.product.sku} · ${lot.product.name}`}
            />
          </Field>
          <Field label={t("lot")}>
            <input className={inputClass} readOnly value={lot.number} />
          </Field>
          <Field label={t("expiryDate")}>
            <input
              className={inputClass}
              name="expiryDate"
              type="date"
              defaultValue={dateInputValue(lot.expiryDate)}
            />
          </Field>
          <Field label={t("manufacturedAtShort")}>
            <input
              className={inputClass}
              name="manufacturedAt"
              type="date"
              defaultValue={dateInputValue(lot.manufacturedAt)}
            />
          </Field>
          <div className="md:col-span-2">
            <button className={buttonClass} type="submit">
              {tSave("save")}
            </button>
          </div>
        </form>
      </Panel>
    </Page>
  );
}
