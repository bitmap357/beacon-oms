/** GET Excel export of incidents using the same filters as the inbox. */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireApiUser, errorResponse } from "@/lib/http";
import { assertFacilityAccess, getAccessibleFacilityIds } from "@/lib/permissions";
import {
  incidentStatusesForFilter,
  labelIncidentStatus,
  reportedAtFilter,
} from "@/lib/incident-status";
import { incidentLabel, labelize } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const ids = await getAccessibleFacilityIds(user);
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const assigneeId = url.searchParams.get("assigneeId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const withoutActions = url.searchParams.get("withoutActions");
    const statusValues = incidentStatusesForFilter(status);
    const dates = reportedAtFilter(from, to);
    if (facilityId) await assertFacilityAccess(user, facilityId);

    const incidents = await prisma.incident.findMany({
      where: {
        facilityId: facilityId ? facilityId : { in: ids },
        ...(statusValues ? { status: { in: statusValues } } : {}),
        ...(priority ? { priority: priority as never } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(dates || {}),
        ...(withoutActions === "1" ? { actions: { none: {} } } : {}),
      },
      include: {
        facility: { select: { name: true } },
        branch: { select: { name: true } },
        assignee: { select: { name: true, email: true } },
        reporter: { select: { name: true } },
      },
      orderBy: { reportedAt: "desc" },
      take: 5000,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Incidents");
    sheet.addRow([
      "Incident",
      "Facility",
      "Branch",
      "Status",
      "Priority",
      "Assignee",
      "Reporter",
      "Date reported",
      "Due date",
      "Closed at",
    ]);
    sheet.getRow(1).font = { bold: true };
    for (const row of incidents) {
      sheet.addRow([
        incidentLabel(row),
        row.facility.name,
        row.branch?.name || "",
        labelIncidentStatus(row.status),
        labelize(row.priority),
        row.assignee?.name || "",
        row.reporter.name,
        row.reportedAt.toISOString().slice(0, 10),
        row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
        row.closedAt ? row.closedAt.toISOString().slice(0, 10) : "",
      ]);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="beacon-incidents.xlsx"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
