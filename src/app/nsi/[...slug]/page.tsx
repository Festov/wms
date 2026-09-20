import { redirect } from "next/navigation";

const MAP: Record<string, string> = {
  nomenclature: "nomenclature",
  counterparties: "counterparties",
  zones: "zones",
  cells: "cells",
  "pallet-types": "pallet_types",
  pallet_types: "pallet_types",
  pallets: "pallets",
  packages: "packages",
  units: "units",
  accounting_models: "accounting_models",
  "accounting-models": "accounting_models",
};

export default async function NsiLegacyRedirect({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const [head, ...rest] = slug;
  const entity = MAP[head];
  if (!entity) redirect("/nsi");
  if (rest[0] === "new") redirect(`/catalog/${entity}/new`);
  if (rest[0]) redirect(`/catalog/${entity}/${rest[0]}`);
  redirect(`/catalog/${entity}`);
}
