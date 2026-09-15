/** POST Excel incident import. Facility is chosen in the UI, never typed in the sheet. */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, hasPermission } from "@/lib/permissions";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import { INCIDENT_STATUSES, INCIDENT_STATUS_ALIASES } from "@/lib/incident-status";
import { incidentRecordFields } from "@/lib/utils";
import type { IncidentPriority, IncidentStatus } from "@/lib/db-types";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;
const PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function cell(row: ExcelJS.Row, index: number) {
  const value = row.getCell(index).value;
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function columnMap(header: ExcelJS.Row) {
  const map = new Map<string, number>();
  header.eachCell((_item, colNumber) => {
    const key = cell(header, colNumber).toLowerCase().replaceAll(" ", "");
    if (key) map.set(key, colNumber);
  });
  return map;
}

function named(row: ExcelJS.Row, map: Map<string, number>, key: string) {
  const index = map.get(key);
  return index ? cell(row, index) : "";
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "incidents.create");
    const limited = await rateLimit(clientKey(request, "incident-import"), 10, 60);
    if (!limited.ok) return json({ error: "Too many import requests" }, 429);

    const form = await request.formData();
    const scopedFacilityId = String(form.get("facilityId") || "");
    if (!scopedFacilityId) throw new HttpError(400, "Choose a facility in Beacon before uploading");
    await assertFacilityAccess(user, scopedFacilityId);

    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Excel file is required");
    if (file.size > MAX_IMPORT_BYTES) throw new HttpError(400, "File exceeds 5 MB");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.subarray(0, 2).toString() !== "PK") {
      throw new HttpError(400, "Upload a valid .xlsx workbook");
    }
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(buffer);
    if (
      detected &&
      detected.mime !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      throw new HttpError(400, "Upload a valid .xlsx workbook");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new HttpError(400, "The workbook has no sheets");

    const columns = columnMap(sheet.getRow(1));
    if (!columns.has("incident") || !columns.has("status") || !columns.has("datereported")) {
      throw new HttpError(
        400,
        "First row must include Incident, Status, and DateReported. Optional: Branch, Priority, AssigneeEmail, DueDate.",
      );
    }

    const facility = await prisma.facility.findUnique({
      where: { id: scopedFacilityId },
      include: { branches: true },
    });
    if (!facility) throw new HttpError(400, "Facility not found");
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });
    const userByEmail = new Map(users.map((row) => [row.email.toLowerCase(), row.id]));
    const canClose = hasPermission(user.role, "qa.manage");

    const created: string[] = [];
    const failed: Array<{ row: number; error: string }> = [];
    const meta = requestMeta(request);
    const rowCount = Math.max(0, sheet.rowCount - 1);
    if (rowCount > MAX_ROWS) {
      throw new HttpError(400, `Workbook exceeds ${MAX_ROWS} incident rows`);
    }

    for (let index = 2; index <= sheet.rowCount; index += 1) {
      const excelRow = sheet.getRow(index);
      const incidentText = named(excelRow, columns, "incident");
      const statusRaw = named(excelRow, columns, "status").toUpperCase().replaceAll(" ", "_");
      const statusMapped = INCIDENT_STATUS_ALIASES[statusRaw] || statusRaw;
      const reportedRaw = named(excelRow, columns, "datereported");
      const branchName = named(excelRow, columns, "branch");
      const priorityRaw = named(excelRow, columns, "priority").toUpperCase() || "MEDIUM";
      const assigneeEmail = named(excelRow, columns, "assigneeemail").toLowerCase();
      const dueDateRaw = named(excelRow, columns, "duedate");
      if (!incidentText && !statusRaw && !reportedRaw) continue;
      if (!incidentText || !statusRaw || !reportedRaw) {
        failed.push({ row: index, error: "Incident, Status, and DateReported are required" });
        continue;
      }
      if (!INCIDENT_STATUSES.includes(statusMapped as IncidentStatus)) {
        failed.push({ row: index, error: "Status must be NEW, IN_PROGRESS, ON_HOLD, REOPENED, or CLOSED" });
        continue;
      }
      if (statusMapped === "CLOSED" && !canClose) {
        failed.push({ row: index, error: "Only PM/QA can import Closed incidents" });
        continue;
      }
      if (!PRIORITIES.has(priorityRaw)) {
        failed.push({ row: index, error: "Priority must be LOW, MEDIUM, HIGH, or CRITICAL" });
        continue;
      }
      const reportedAt = new Date(reportedRaw);
      if (Number.isNaN(reportedAt.getTime())) {
        failed.push({ row: index, error: "DateReported is not a valid date" });
        continue;
      }
      const branch = branchName
        ? facility.branches.find((row) => row.name.toLowerCase() === branchName.toLowerCase())
        : null;
      if (branchName && !branch) {
        failed.push({ row: index, error: `Unknown branch ${branchName}` });
        continue;
      }
      const assigneeId = assigneeEmail ? userByEmail.get(assigneeEmail) : null;
      if (assigneeEmail && !assigneeId) {
        failed.push({ row: index, error: `Unknown assignee ${assigneeEmail}` });
        continue;
      }
      const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
      if (dueDateRaw && Number.isNaN(dueDate?.getTime())) {
        failed.push({ row: index, error: "DueDate is not a valid date" });
        continue;
      }

      const incident = await prisma.$transaction(async (tx) => {
        const next = await tx.incident.create({
          data: {
            ...incidentRecordFields({ description: incidentText }),
            facilityId: facility.id,
            branchId: branch?.id || null,
            reporterId: user.id,
            priority: priorityRaw as IncidentPriority,
            assigneeId: assigneeId || null,
            dueDate,
            reportedAt,
            status: statusMapped as IncidentStatus,
          },
        });
        await tx.incidentHistory.create({
          data: {
            incidentId: next.id,
            changedById: user.id,
            fieldChanged: "status",
            oldValue: null,
            newValue: next.status,
          },
        });
        await logAudit(tx, {
          userId: user.id,
          action: "incident.imported",
          entityType: "Incident",
          entityId: next.id,
          newValue: { facilityId: facility.id, row: index },
          ...meta,
        });
        await refreshFacilityHealth(facility.id, tx);
        return next;
      });
      created.push(incident.id);
    }

    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: "incidents.imported",
        entityType: "Incident",
        entityId: created[0] || "none",
        newValue: { created: created.length, failed: failed.length, fileName: file.name },
        ...meta,
      });
    });

    return json({ created: created.length, failed, ids: created }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
