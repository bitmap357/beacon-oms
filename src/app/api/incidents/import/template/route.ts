/** GET the Excel template for imports. Incidents have no title or description. */
import ExcelJS from "exceljs";
import { requireApiUser } from "@/lib/http";
import { errorResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const scoped = Boolean(new URL(request.url).searchParams.get("facilityId"));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Incidents");
    if (scoped) {
      sheet.addRow(["Branch", "Priority", "AssigneeEmail", "DueDate"]);
      sheet.addRow(["Laboratory", "HIGH", "dev@spagad.local", "2026-09-21"]);
    } else {
      sheet.addRow(["Facility", "Branch", "Priority", "AssigneeEmail", "DueDate"]);
      sheet.addRow([
        "Focos Orthopedics Hospital",
        "Laboratory",
        "HIGH",
        "dev@spagad.local",
        "2026-09-21",
      ]);
    }
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
