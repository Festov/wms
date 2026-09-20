import type { PrismaClient } from "@/generated/prisma/client";
import { invalidateMetaEntityCache } from "@/lib/meta/cache";
import {
  serializeCapabilities,
  type DocumentCapability,
  type LineDefinitionDef,
} from "@/lib/meta/types";

type AttrDef = {
  code: string;
  name: string;
  type?: string;
  required?: boolean;
  systemField: string;
  listVisible?: boolean;
  formVisible?: boolean;
  section?: string;
  refEntityCode?: string;
  enumValues?: string[];
  widget?: string;
};

type EntityDef = {
  code: string;
  name: string;
  pluralName: string;
  kind?: "catalog" | "document" | "journal";
  handler?: string;
  capabilities?: DocumentCapability[];
  sections: { code: string; name: string }[];
  attributes: AttrDef[];
  lineDefinitions?: LineDefinitionDef[];
};

const ENTITIES: EntityDef[] = [
  {
    code: "units",
    name: "Единица измерения",
    pluralName: "Единицы",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "name", name: "Название", required: true, systemField: "name", section: "main" },
      { code: "symbol", name: "Обозначение", systemField: "symbol", section: "main" },
    ],
  },
  {
    code: "zones",
    name: "Зона",
    pluralName: "Зоны",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "name", name: "Название", required: true, systemField: "name", section: "main" },
      {
        code: "type",
        name: "Тип хранения",
        type: "enum",
        required: true,
        systemField: "type",
        section: "main",
        enumValues: ["RECEIVING", "STORAGE", "SHIPPING", "QUARANTINE"],
      },
      { code: "notes", name: "Комментарий", systemField: "notes", section: "main", listVisible: false },
    ],
  },
  {
    code: "counterparties",
    name: "Контрагент",
    pluralName: "Контрагенты",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "name", name: "Название", required: true, systemField: "name", section: "main" },
      {
        code: "kind",
        name: "Тип контрагента",
        type: "enum",
        systemField: "kind",
        section: "main",
        enumValues: ["SUPPLIER", "CUSTOMER", "BOTH"],
      },
      { code: "inn", name: "ИНН", systemField: "inn", section: "main" },
      { code: "phone", name: "Телефон", systemField: "phone", section: "main", listVisible: false },
      { code: "email", name: "Эл. почта", systemField: "email", section: "main", listVisible: false },
    ],
  },
  {
    code: "receiving_docks",
    name: "Рампа",
    pluralName: "Рампы",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "name", name: "Название", required: true, systemField: "name", section: "main" },
      {
        code: "zoneId",
        name: "Зона",
        type: "ref",
        refEntityCode: "zones",
        systemField: "zoneId",
        section: "main",
      },
      {
        code: "status",
        name: "Статус",
        type: "enum",
        systemField: "status",
        section: "main",
        enumValues: ["FREE", "BUSY"],
        listVisible: true,
        formVisible: true,
      },
      {
        code: "notes",
        name: "Примечание",
        systemField: "notes",
        section: "main",
        listVisible: false,
      },
      {
        code: "isActive",
        name: "Активна",
        type: "bool",
        systemField: "isActive",
        section: "main",
        listVisible: false,
      },
    ],
  },
  {
    code: "transport_units",
    name: "Транспорт",
    pluralName: "Транспорт",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      {
        code: "plateNumber",
        name: "Госномер",
        required: true,
        systemField: "plateNumber",
        section: "main",
      },
      {
        code: "driverName",
        name: "Водитель",
        required: true,
        systemField: "driverName",
        section: "main",
      },
      {
        code: "carrierName",
        name: "Перевозчик",
        systemField: "carrierName",
        section: "main",
        listVisible: false,
      },
      {
        code: "driverPhone",
        name: "Телефон",
        systemField: "driverPhone",
        section: "main",
        listVisible: false,
      },
      {
        code: "driverLicense",
        name: "Вод. удостоверение",
        systemField: "driverLicense",
        section: "main",
        listVisible: false,
      },
      {
        code: "passport",
        name: "Паспорт",
        systemField: "passport",
        section: "main",
        listVisible: false,
      },
      {
        code: "notes",
        name: "Примечание",
        systemField: "notes",
        section: "main",
        listVisible: false,
      },
      {
        code: "isActive",
        name: "Активен",
        type: "bool",
        systemField: "isActive",
        section: "main",
        listVisible: false,
      },
    ],
  },
  {
    code: "packages",
    name: "Упаковка",
    pluralName: "Упаковки",
    sections: [
      { code: "main", name: "Основные" },
      { code: "vgkh", name: "ВГХ" },
    ],
    attributes: [
      {
        code: "productId",
        name: "Номенклатура",
        type: "ref",
        required: true,
        systemField: "productId",
        section: "main",
        refEntityCode: "nomenclature",
      },
      {
        code: "unitId",
        name: "Единица",
        type: "ref",
        required: true,
        systemField: "unitId",
        section: "main",
        refEntityCode: "units",
      },
      {
        code: "factor",
        name: "Коэффициент",
        type: "number",
        required: true,
        systemField: "factor",
        section: "main",
      },
      {
        code: "barcode",
        name: "Штрихкод",
        systemField: "barcode",
        section: "main",
        listVisible: true,
      },
      {
        code: "name",
        name: "Название",
        systemField: "name",
        section: "main",
        listVisible: true,
      },
      {
        code: "code",
        name: "Код",
        systemField: "code",
        section: "main",
        listVisible: false,
      },
      {
        code: "lengthMm",
        name: "Длина, мм",
        type: "number",
        systemField: "lengthMm",
        section: "vgkh",
        listVisible: false,
      },
      {
        code: "widthMm",
        name: "Ширина, мм",
        type: "number",
        systemField: "widthMm",
        section: "vgkh",
        listVisible: false,
      },
      {
        code: "heightMm",
        name: "Высота, мм",
        type: "number",
        systemField: "heightMm",
        section: "vgkh",
        listVisible: false,
      },
      {
        code: "weightGrossKg",
        name: "Вес брутто, кг",
        type: "number",
        systemField: "weightGrossKg",
        section: "vgkh",
        listVisible: false,
      },
    ],
  },
  {
    code: "pallet_types",
    name: "Тип товарного носителя",
    pluralName: "Типы ТН",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "code", name: "Код", required: true, systemField: "code", section: "main" },
      { code: "name", name: "Название", required: true, systemField: "name", section: "main" },
      {
        code: "barcodeTemplate",
        name: "Шаблон штрихкода",
        systemField: "barcodeTemplate",
        section: "main",
        listVisible: true,
      },
      { code: "lengthMm", name: "Длина, мм", type: "number", systemField: "lengthMm", section: "main" },
      { code: "widthMm", name: "Ширина, мм", type: "number", systemField: "widthMm", section: "main" },
      { code: "heightMm", name: "Высота, мм", type: "number", systemField: "heightMm", section: "main" },
      {
        code: "weightOwnKg",
        name: "Собственный вес, кг",
        type: "number",
        systemField: "weightOwnKg",
        section: "main",
        listVisible: false,
      },
      {
        code: "maxWeightKg",
        name: "Грузоподъёмность, кг",
        type: "number",
        systemField: "maxWeightKg",
        section: "main",
        listVisible: false,
      },
    ],
  },
  {
    code: "pallets",
    name: "Товарный носитель",
    pluralName: "Товарные носители",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "code", name: "Код", systemField: "code", section: "main", listVisible: true },
      {
        code: "palletTypeId",
        name: "Тип",
        type: "ref",
        required: true,
        systemField: "palletTypeId",
        section: "main",
        refEntityCode: "pallet_types",
      },
      { code: "barcode", name: "Штрихкод", systemField: "barcode", section: "main", listVisible: true },
      {
        code: "status",
        name: "Статус",
        type: "enum",
        systemField: "status",
        section: "main",
        enumValues: ["AVAILABLE", "ACCEPTED", "PLACED"],
        listVisible: true,
      },
    ],
  },
  {
    code: "cells",
    name: "Ячейка",
    pluralName: "Ячейки",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "code", name: "Штрих-код", required: true, systemField: "code", section: "main" },
      { code: "name", name: "Название", required: true, systemField: "name", section: "main" },
      {
        code: "zoneId",
        name: "Зона",
        type: "ref",
        required: true,
        systemField: "zoneId",
        section: "main",
        refEntityCode: "zones",
      },
    ],
  },
  {
    code: "nomenclature",
    name: "Номенклатура",
    pluralName: "Номенклатура",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "sku", name: "Артикул", required: true, systemField: "sku", section: "main" },
      { code: "name", name: "Название", required: true, systemField: "name", section: "main" },
      { code: "barcode", name: "Штрихкод", systemField: "barcode", section: "main" },
      {
        code: "unitId",
        name: "Единица измерения",
        type: "ref",
        required: true,
        systemField: "unitId",
        section: "main",
        refEntityCode: "units",
      },
      {
        code: "accountingModelId",
        name: "Модель учёта",
        type: "ref",
        required: true,
        systemField: "accountingModelId",
        section: "main",
        refEntityCode: "accounting_models",
        listVisible: true,
      },
      {
        code: "shelfLifeDays",
        name: "Срок хранения",
        type: "number",
        systemField: "shelfLifeDays",
        section: "main",
        listVisible: false,
      },
      {
        code: "shelfLifeUnit",
        name: "Ед. срока хранения",
        type: "enum",
        systemField: "shelfLifeUnit",
        section: "main",
        enumValues: ["DAY", "WEEK", "MONTH", "YEAR"],
        listVisible: false,
      },
    ],
  },
  {
    code: "accounting_models",
    name: "Модель учёта",
    pluralName: "Модели учёта",
    sections: [{ code: "main", name: "Основные" }],
    attributes: [
      { code: "name", name: "Название", required: true, systemField: "name", section: "main", listVisible: true },
      {
        code: "useLots",
        name: "Учёт по партиям",
        type: "bool",
        systemField: "useLots",
        section: "main",
        listVisible: true,
      },
      {
        code: "useExpiry",
        name: "Срок годности",
        type: "bool",
        systemField: "useExpiry",
        section: "main",
        listVisible: true,
      },
      {
        code: "useSerial",
        name: "Серийные номера",
        type: "bool",
        systemField: "useSerial",
        section: "main",
        listVisible: true,
      },
      {
        code: "lotNameTemplate",
        name: "Шаблон имени партии",
        systemField: "lotNameTemplate",
        section: "main",
        listVisible: true,
      },
    ],
  },
  {
    code: "inbound",
    name: "Документ приёмки",
    pluralName: "Приёмка",
    kind: "document",
    handler: "inbound",
    capabilities: ["lines", "workflow", "stock", "tsd"],
    lineDefinitions: [
      {
        code: "lines",
        name: "Товары",
        columns: [
          { code: "lineNo", name: "№", systemField: "lineNo", listVisible: true },
          {
            code: "product",
            name: "Товар",
            type: "ref",
            systemField: "product",
            refEntityCode: "nomenclature",
            listVisible: true,
          },
          {
            code: "package",
            name: "Упаковка",
            type: "ref",
            systemField: "package",
            refEntityCode: "packages",
            listVisible: true,
          },
          {
            code: "lot",
            name: "Партия",
            type: "ref",
            systemField: "lot",
            refEntityCode: "lots",
            listVisible: true,
          },
          {
            code: "quantity",
            name: "Кол-во",
            type: "number",
            systemField: "quantity",
            listVisible: true,
          },
        ],
      },
    ],
    sections: [
      { code: "header", name: "Шапка" },
      { code: "main", name: "Реквизиты" },
      { code: "extra", name: "Доп. реквизиты" },
    ],
    attributes: [
      {
        code: "number",
        name: "Номер",
        systemField: "number",
        section: "header",
        listVisible: true,
        widget: "readonly",
      },
      {
        code: "supplier",
        name: "Поставщик",
        required: true,
        systemField: "supplier",
        section: "header",
        listVisible: true,
        widget: "counterparty_supplier",
      },
      {
        code: "expectedDate",
        name: "Дата поступления",
        type: "date",
        required: true,
        systemField: "expectedDate",
        section: "header",
        listVisible: true,
      },
      {
        code: "kind",
        name: "Тип приёмки",
        type: "enum",
        required: true,
        systemField: "kind",
        section: "main",
        listVisible: true,
        enumValues: ["PLANNED", "URGENT", "RETURN", "TRANSFER"],
      },
      {
        code: "purchaseOrderRef",
        name: "Заказ поставщика (PO)",
        systemField: "purchaseOrderRef",
        section: "main",
        listVisible: true,
      },
      {
        code: "waybillRef",
        name: "ТТН / накладная",
        systemField: "waybillRef",
        section: "main",
        listVisible: true,
      },
      {
        code: "externalRef",
        name: "Внешний номер (ERP)",
        systemField: "externalRef",
        section: "main",
      },
      {
        code: "actualArrivalAt",
        name: "Фактическое прибытие",
        type: "date",
        systemField: "actualArrivalAt",
        section: "main",
      },
      {
        code: "receivingDockId",
        name: "Рампа / зона",
        systemField: "receivingDockId",
        section: "main",
        widget: "receivingDock",
      },
      {
        code: "transportUnitId",
        name: "Транспорт",
        systemField: "transportUnitId",
        section: "main",
        widget: "transportUnit",
      },
      {
        code: "notes",
        name: "Комментарий",
        systemField: "notes",
        section: "main",
        listVisible: false,
      },
    ],
  },
  {
    code: "outbound",
    name: "Документ отгрузки",
    pluralName: "Отгрузка",
    kind: "document",
    handler: "outbound",
    capabilities: ["lines", "workflow", "stock", "tsd"],
    lineDefinitions: [
      {
        code: "lines",
        name: "Товары",
        columns: [
          { code: "lineNo", name: "№", systemField: "lineNo", listVisible: true },
          {
            code: "product",
            name: "Товар",
            type: "ref",
            systemField: "product",
            refEntityCode: "nomenclature",
            listVisible: true,
          },
          {
            code: "package",
            name: "Упаковка",
            type: "ref",
            systemField: "package",
            refEntityCode: "packages",
            listVisible: true,
          },
          {
            code: "location",
            name: "Ячейка",
            type: "ref",
            systemField: "location",
            refEntityCode: "cells",
            listVisible: true,
          },
          {
            code: "lot",
            name: "Партия",
            type: "ref",
            systemField: "lot",
            refEntityCode: "lots",
            listVisible: true,
          },
          {
            code: "quantity",
            name: "Кол-во",
            type: "number",
            systemField: "quantity",
            listVisible: true,
          },
        ],
      },
    ],
    sections: [
      { code: "header", name: "Шапка" },
      { code: "main", name: "Реквизиты" },
      { code: "extra", name: "Доп. реквизиты" },
    ],
    attributes: [
      {
        code: "number",
        name: "Номер",
        systemField: "number",
        section: "header",
        listVisible: true,
        widget: "readonly",
      },
      {
        code: "customer",
        name: "Клиент",
        systemField: "customer",
        section: "header",
        listVisible: true,
        widget: "counterparty_customer",
      },
      {
        code: "shipDate",
        name: "Дата отгрузки",
        type: "date",
        systemField: "shipDate",
        section: "header",
        listVisible: true,
      },
      {
        code: "kind",
        name: "Тип отгрузки",
        type: "enum",
        required: true,
        systemField: "kind",
        section: "main",
        listVisible: true,
        enumValues: ["PLANNED", "URGENT", "RETURN", "TRANSFER"],
      },
      {
        code: "salesOrderRef",
        name: "Заказ клиента (SO)",
        systemField: "salesOrderRef",
        section: "main",
        listVisible: true,
      },
      {
        code: "waybillRef",
        name: "ТТН / накладная",
        systemField: "waybillRef",
        section: "main",
        listVisible: true,
      },
      {
        code: "externalRef",
        name: "Внешний номер (ERP)",
        systemField: "externalRef",
        section: "main",
      },
      {
        code: "actualShipmentAt",
        name: "Фактическая отгрузка",
        type: "date",
        systemField: "actualShipmentAt",
        section: "main",
      },
      {
        code: "receivingDockId",
        name: "Рампа / зона",
        systemField: "receivingDockId",
        section: "main",
        widget: "receivingDock",
      },
      {
        code: "transportUnitId",
        name: "Транспорт",
        systemField: "transportUnitId",
        section: "main",
        widget: "transportUnit",
      },
      {
        code: "notes",
        name: "Комментарий",
        systemField: "notes",
        section: "main",
        listVisible: false,
      },
    ],
  },
  {
    code: "operation",
    name: "Операция",
    pluralName: "Операции",
    kind: "journal",
    handler: "operation",
    capabilities: ["lines", "workflow"],
    lineDefinitions: [
      {
        code: "lines",
        name: "Строки",
        columns: [
          { code: "lineNo", name: "№", systemField: "lineNo", listVisible: true },
          {
            code: "product",
            name: "Товар",
            type: "ref",
            systemField: "product",
            refEntityCode: "nomenclature",
            listVisible: true,
          },
          {
            code: "package",
            name: "Упаковка",
            type: "ref",
            systemField: "package",
            refEntityCode: "packages",
            listVisible: true,
          },
          {
            code: "lot",
            name: "Партия",
            type: "ref",
            systemField: "lot",
            refEntityCode: "lots",
            listVisible: true,
          },
          {
            code: "pallet",
            name: "ТН",
            type: "ref",
            systemField: "pallet",
            refEntityCode: "pallets",
            listVisible: true,
          },
          {
            code: "fromLocation",
            name: "Откуда",
            type: "ref",
            systemField: "fromLocation",
            refEntityCode: "cells",
            listVisible: true,
          },
          {
            code: "toLocation",
            name: "Куда",
            type: "ref",
            systemField: "toLocation",
            refEntityCode: "cells",
            listVisible: true,
          },
          {
            code: "quantity",
            name: "Кол-во",
            type: "number",
            systemField: "quantity",
            listVisible: true,
          },
        ],
      },
    ],
    sections: [{ code: "main", name: "Реквизиты" }],
    attributes: [
      {
        code: "number",
        name: "Номер",
        systemField: "number",
        section: "main",
        listVisible: true,
        widget: "readonly",
      },
      {
        code: "type",
        name: "Тип",
        systemField: "type",
        section: "main",
        listVisible: true,
        widget: "readonly",
      },
      {
        code: "status",
        name: "Статус",
        systemField: "status",
        section: "main",
        listVisible: true,
        widget: "readonly",
      },
      {
        code: "notes",
        name: "Примечание",
        systemField: "notes",
        section: "main",
        listVisible: false,
      },
    ],
  },
];

export async function seedSystemMeta(prisma: PrismaClient) {
  for (const def of ENTITIES) {
    const entity = await prisma.metaEntity.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        pluralName: def.pluralName,
        kind: def.kind ?? "catalog",
        storage: "system",
        handler: def.handler ?? null,
        routePrefix: def.kind === "catalog" ? null : "/doc",
        capabilities: def.capabilities
          ? serializeCapabilities(def.capabilities)
          : null,
      },
      update: {
        name: def.name,
        pluralName: def.pluralName,
        kind: def.kind ?? "catalog",
        storage: "system",
        handler: def.handler ?? null,
        routePrefix: def.kind === "catalog" ? null : "/doc",
        capabilities: def.capabilities
          ? serializeCapabilities(def.capabilities)
          : null,
      },
    });

    const sectionMap = new Map<string, string>();
    for (const [i, sec] of def.sections.entries()) {
      const section = await prisma.metaFormSection.upsert({
        where: { entityId_code: { entityId: entity.id, code: sec.code } },
        create: {
          entityId: entity.id,
          code: sec.code,
          name: sec.name,
          order: i,
        },
        update: { name: sec.name, order: i },
      });
      sectionMap.set(sec.code, section.id);
    }

    for (const [i, attr] of def.attributes.entries()) {
      await prisma.metaAttribute.upsert({
        where: { entityId_code: { entityId: entity.id, code: attr.code } },
        create: {
          entityId: entity.id,
          code: attr.code,
          name: attr.name,
          type: attr.type ?? "string",
          required: attr.required ?? false,
          systemField: attr.systemField,
          isSystem: true,
          listVisible: attr.listVisible ?? true,
          formVisible: attr.formVisible ?? true,
          widget: attr.widget ?? null,
          order: i,
          sectionId: attr.section ? sectionMap.get(attr.section) : null,
          refEntityCode: attr.refEntityCode ?? null,
          enumValues: attr.enumValues ? JSON.stringify(attr.enumValues) : null,
        },
        update: {
          name: attr.name,
          type: attr.type ?? "string",
          required: attr.required ?? false,
          systemField: attr.systemField,
          isSystem: true,
          listVisible: attr.listVisible ?? true,
          formVisible: attr.formVisible ?? true,
          widget: attr.widget ?? null,
          order: i,
          sectionId: attr.section ? sectionMap.get(attr.section) : null,
          refEntityCode: attr.refEntityCode ?? null,
          enumValues: attr.enumValues ? JSON.stringify(attr.enumValues) : null,
        },
      });
    }

    const keep = def.attributes.map((a) => a.code);
    await prisma.metaAttribute.deleteMany({
      where: {
        entityId: entity.id,
        isSystem: true,
        code: { notIn: keep },
      },
    });

    if (def.lineDefinitions?.length) {
      for (const [lineIndex, lineDef] of def.lineDefinitions.entries()) {
        const line = await prisma.metaLineDefinition.upsert({
          where: {
            entityId_code: {
              entityId: entity.id,
              code: lineDef.code ?? "lines",
            },
          },
          create: {
            entityId: entity.id,
            code: lineDef.code ?? "lines",
            name: lineDef.name,
            sortOrder: lineIndex,
          },
          update: {
            name: lineDef.name,
            sortOrder: lineIndex,
          },
        });

        for (const [colIndex, col] of lineDef.columns.entries()) {
          await prisma.metaLineColumn.upsert({
            where: {
              lineDefId_code: { lineDefId: line.id, code: col.code },
            },
            create: {
              lineDefId: line.id,
              code: col.code,
              name: col.name,
              type: col.type ?? "string",
              systemField: col.systemField ?? null,
              refEntityCode: col.refEntityCode ?? null,
              required: col.required ?? false,
              listVisible: col.listVisible ?? true,
              sortOrder: colIndex,
            },
            update: {
              name: col.name,
              type: col.type ?? "string",
              systemField: col.systemField ?? null,
              refEntityCode: col.refEntityCode ?? null,
              required: col.required ?? false,
              listVisible: col.listVisible ?? true,
              sortOrder: colIndex,
            },
          });
        }

        const keepCols = lineDef.columns.map((c) => c.code);
        await prisma.metaLineColumn.deleteMany({
          where: {
            lineDefId: line.id,
            code: { notIn: keepCols },
          },
        });
      }
    }
  }
  invalidateMetaEntityCache();
}

/** Bump when ENTITIES definitions change (new catalogs, attribute migrations). */
export const META_SEED_REV = 1;
const META_SEED_KEY = "metaSeedRev";

/** Добавляет недостающие системные сущности мета-модели (один раз на ревизию). */
export async function ensureSystemMeta(prisma: PrismaClient) {
  const g = globalThis as typeof globalThis & { __wmsMetaSeedEnsured?: boolean };
  if (g.__wmsMetaSeedEnsured) return;

  const stored = await prisma.appSetting.findUnique({
    where: { key: META_SEED_KEY },
  });
  if (stored && Number(stored.value) >= META_SEED_REV) {
    g.__wmsMetaSeedEnsured = true;
    return;
  }

  await seedSystemMeta(prisma);
  await prisma.appSetting.upsert({
    where: { key: META_SEED_KEY },
    create: { key: META_SEED_KEY, value: String(META_SEED_REV) },
    update: { value: String(META_SEED_REV) },
  });
  g.__wmsMetaSeedEnsured = true;
}
