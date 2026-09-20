import { describe, expect, it } from "vitest";
import type { MetaLineColumn } from "@/generated/prisma/client";
import {
  lineDataFromForm,
  lineRowFromData,
  validateLineForm,
} from "@/lib/meta/custom-lines";

function column(
  overrides: Partial<MetaLineColumn> & Pick<MetaLineColumn, "code" | "name">,
): MetaLineColumn {
  return {
    id: overrides.id ?? "col-1",
    lineDefId: overrides.lineDefId ?? "def-1",
    type: overrides.type ?? "string",
    systemField: overrides.systemField ?? null,
    refEntityCode: overrides.refEntityCode ?? null,
    required: overrides.required ?? false,
    listVisible: overrides.listVisible ?? true,
    sortOrder: overrides.sortOrder ?? 0,
    code: overrides.code,
    name: overrides.name,
  };
}

describe("custom document lines", () => {
  it("validates required columns", () => {
    const columns = [
      column({ code: "name", name: "Наименование", required: true }),
      column({ code: "qty", name: "Количество", type: "number" }),
    ];
    const formData = new FormData();
    formData.set("qty", "2");

    expect(() => validateLineForm(columns, formData)).toThrow(
      "Заполните поле «Наименование»",
    );
  });

  it("builds line data from form", () => {
    const columns = [
      column({ code: "name", name: "Наименование", required: true }),
      column({ code: "qty", name: "Количество", type: "number", required: true }),
    ];
    const formData = new FormData();
    formData.set("name", "Товар");
    formData.set("qty", "3");

    expect(lineDataFromForm(columns, formData)).toEqual({
      name: "Товар",
      qty: 3,
    });
  });

  it("maps stored json to table row with ref labels", () => {
    const columns = [
      column({ code: "name", name: "Наименование" }),
      column({
        code: "product",
        name: "Товар",
        type: "ref",
        refEntityCode: "products",
      }),
    ];

    const row = lineRowFromData(
      {
        id: "line-1",
        lineNo: 1,
        dataJson: JSON.stringify({ name: "Позиция", product: "prod-1" }),
      },
      columns,
      { product: { "prod-1": "SKU-1 · Товар" } },
    );

    expect(row).toMatchObject({
      id: "line-1",
      lineNo: 1,
      name: "Позиция",
      product: "SKU-1 · Товар",
    });
  });

  it("accepts updated form values for line data", () => {
    const columns = [
      column({ code: "name", name: "Наименование", required: true }),
      column({ code: "qty", name: "Количество", type: "number", required: true }),
    ];
    const formData = new FormData();
    formData.set("name", "Обновлено");
    formData.set("qty", "10");

    expect(() => validateLineForm(columns, formData)).not.toThrow();
    expect(lineDataFromForm(columns, formData)).toEqual({
      name: "Обновлено",
      qty: 10,
    });
  });
});
