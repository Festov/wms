import { NextRequest, NextResponse } from "next/server";
import { buildInventoryExcel } from "@/lib/inventory-export-excel";
import {
  buildInventoryCsv,
  parseInventoryReportParams,
  queryInventoryReport,
} from "@/lib/inventory-report";
import { isModuleFlagEnabled, requireModule } from "@/lib/session";
import { jsonApiError } from "@/lib/tsd-auth";

export async function GET(request: NextRequest) {
  await requireModule("inventory");
  const lotsEnabled = await isModuleFlagEnabled("lots");
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const params = parseInventoryReportParams(raw);
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (!params.shouldRun) {
    return jsonApiError("inventoryFiltersRequired");
  }

  const result = await queryInventoryReport(params, { forExport: true });
  if (!result) {
    return jsonApiError("noData");
  }

  const date = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const buffer = await buildInventoryExcel(result, lotsEnabled, params.groupBy);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ostatki-${date}.xlsx"`,
      },
    });
  }

  const csv = `\uFEFF${buildInventoryCsv(result, lotsEnabled, params.groupBy)}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ostatki-${date}.csv"`,
    },
  });
}
