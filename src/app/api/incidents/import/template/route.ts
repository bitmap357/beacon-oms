/** GET the Excel template for imports. Facility is chosen in the app, not in the sheet. */
import ExcelJS from "exceljs";
import { requireApiUser } from "@/lib/http";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireApiUser();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Incidents");
    sheet.addRow(["Incident", "Status", "DateReported", "Branch", "Priority", "AssigneeEmail", "DueDate"]);
    sheet.addRow([
      "Lab results not posting to HIS",
      "NEW",
      "2026-09-15",
      "Laboratory",
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
