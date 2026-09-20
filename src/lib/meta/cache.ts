import type { Prisma } from "@/generated/prisma/client";

export type CachedMetaEntity = Prisma.MetaEntityGetPayload<{
  include: {
    attributes: { include: { section: true } };
    sections: true;
  };
}>;

export type CachedMetaEntityList = Prisma.MetaEntityGetPayload<{
  include: { _count: { select: { attributes: true; records: true } } };
}>[];

const entityCache = new Map<string, CachedMetaEntity>();
let listEntitiesCache: CachedMetaEntityList | null = null;

export function getCachedMetaEntity(code: string): CachedMetaEntity | undefined {
  return entityCache.get(code);
}

export function setCachedMetaEntity(code: string, entity: CachedMetaEntity) {
  entityCache.set(code, entity);
}

export function invalidateMetaEntityCache(code?: string) {
  if (code) {
    entityCache.delete(code);
  } else {
    entityCache.clear();
  }
  listEntitiesCache = null;
}

export function getCachedMetaEntityList(): CachedMetaEntityList | null {
  return listEntitiesCache;
}

export function setCachedMetaEntityList(list: CachedMetaEntityList) {
  listEntitiesCache = list;
}
