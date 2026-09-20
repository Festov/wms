import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getMetaEntity } from "@/lib/meta/catalog";

export type NomenclatureFilterAttr = {
  code: string;
  name: string;
  type: string;
  enumValues: string[] | null;
  refEntityCode: string | null;
};

export async function getNomenclatureFilterAttributes(): Promise<
  NomenclatureFilterAttr[]
> {
  const entity = await getMetaEntity("nomenclature");
  if (!entity) return [];
  return entity.attributes
    .filter((a) => !a.systemField && !a.isSystem && a.formVisible)
    .map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      enumValues: a.enumValues
        ? (JSON.parse(a.enumValues) as string[])
        : null,
      refEntityCode: a.refEntityCode,
    }));
}

/** null = фильтр не задан; [] = нет подходящих товаров */
export async function resolveProductIdsByMetaFilter(
  attrCode: string,
  rawValue: string,
): Promise<string[] | null> {
  const code = attrCode.trim();
  const value = rawValue.trim();
  if (!code || !value) return null;

  const entity = await getMetaEntity("nomenclature");
  if (!entity) return [];

  const attr = entity.attributes.find((a) => a.code === code);
  if (!attr || attr.isSystem || attr.systemField) return [];

  const baseWhere: Prisma.MetaValueWhereInput = {
    attributeId: attr.id,
  };

  if (attr.type === "number") {
    const num = Number(value);
    if (!Number.isFinite(num)) return [];
    baseWhere.valueNumber = num;
  } else if (attr.type === "bool") {
    baseWhere.valueBool = value === "1" || value.toLowerCase() === "true";
  } else if (attr.type === "enum") {
    baseWhere.valueText = value;
  } else if (attr.type === "ref") {
    baseWhere.OR = [{ valueText: value }, { valueText: { contains: value } }];
  } else {
    baseWhere.valueText = { contains: value };
  }

  const matches = await prisma.metaValue.findMany({
    where: baseWhere,
    include: { record: { select: { code: true } } },
  });

  const ids = [
    ...new Set(
      matches.map((m) => m.record.code).filter((id): id is string => Boolean(id)),
    ),
  ];
  return ids;
}
