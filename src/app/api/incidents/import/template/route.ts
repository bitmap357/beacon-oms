/** GET the Excel template for imports. */
import ExcelJS from "exceljs";
import { requireApiUser } from "@/lib/http";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireApiUser();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Incidents");
    sheet.addRow([
      "Facility",
      "Branch",
      "Title",
      "Description",
      "Priority",
      "AssigneeEmail",
      "DueDate",
    ]);
    sheet.addRow([
      "Focos Orthopedics Hospital",
      "Laboratory",
      "Analyser interface timeout",
      "Lab results are delayed when the analyser queue is busy.",
      "HIGH",
      "dev@spagad.local",
      "2026-09-21",
    ]);
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="beacon-incident-import.xlsx"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
