-- Раздел меню для пользовательских справочников
ALTER TABLE "MetaEntity" ADD COLUMN "navItemCode" TEXT;

CREATE INDEX "MetaEntity_navItemCode_idx" ON "MetaEntity"("navItemCode");

-- Справочники, привязанные к пункту меню через metaEntityCode, переезжают внутрь раздела
UPDATE "MetaEntity"
SET "navItemCode" = (
  SELECT "code" FROM "NavItem" WHERE "NavItem"."metaEntityCode" = "MetaEntity"."code" LIMIT 1
)
WHERE "code" IN (
  SELECT "metaEntityCode" FROM "NavItem" WHERE "metaEntityCode" IS NOT NULL
);

-- Пункты меню ведут на хаб раздела, а не на один справочник
UPDATE "NavItem"
SET "href" = '/m/' || REPLACE("code", 'nav:', '')
WHERE "code" LIKE 'nav:%';

UPDATE "NavItem" SET "metaEntityCode" = NULL WHERE "code" LIKE 'nav:%';
