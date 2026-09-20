import ExcelJS from "exceljs";
import {
  buildInventoryExportTable,
  type InventoryGroupBy,
  type InventoryReportResult,
} from "@/lib/inventory-report";

export async function buildInventoryExcel(
  result: InventoryReportResult,
  lotsEnabled: boolean,
  groupBy: InventoryGroupBy = "detail",
) {
  const { headers, rows } = buildInventoryExportTable(
    result,
    lotsEnabled,
    groupBy,
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WMS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Остатки", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F5E9" },
  };

  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column) => {
    let max = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = Math.min(len + 2, 48);
    });
    column.width = max;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
