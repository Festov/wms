import { prisma } from "@/lib/db";
import type { MetaLineColumn } from "@/generated/prisma/client";

export type MetaLineDefinitionFull = {
  id: string;
  code: string;
  name: string;
  columns: MetaLineColumn[];
};

export async function loadLineDefinitions(
  entityCode: string,
): Promise<MetaLineDefinitionFull[]> {
  const entity = await prisma.metaEntity.findUnique({
    where: { code: entityCode },
    include: {
      lineDefinitions: {
        orderBy: { sortOrder: "asc" },
        include: {
          columns: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  return entity?.lineDefinitions ?? [];
}

export async function loadLineDefinition(
  entityCode: string,
  lineCode = "lines",
): Promise<MetaLineDefinitionFull | null> {
  const defs = await loadLineDefinitions(entityCode);
  return defs.find((d) => d.code === lineCode) ?? null;
}
