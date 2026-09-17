/**
 * POST Excel incident import.
 * mode=preview (default for UI): parse + validate + duplicate flags, no writes.
 * mode=commit: create rows (same validation). Facility chosen in UI, never typed in sheet.
 */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, hasPermission } from "@/lib/permissions";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import { allocateIncidentNumber } from "@/lib/incident-number";
import { INCIDENT_STATUSES, INCIDENT_STATUS_ALIASES } from "@/lib/incident-status";
import { incidentRecordFields } from "@/lib/utils";
import type { IncidentPriority, IncidentStatus } from "@/lib/db-types";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;
const PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export type ImportPreviewRow = {
  row: number;
  incident: string;
  status: string;
  dateReported: string;
  branch: string | null;
  branchId: string | null;
  priority: string;
  assigneeEmail: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  error?: string;
  duplicate?: boolean;
  duplicateOf?: string;
};

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

function dupKey(facilityId: string, description: string, reportedAt: Date) {
  const day = reportedAt.toISOString().slice(0, 10);
  return `${facilityId}|${description.trim().toLowerCase()}|${day}`;
}

async function parseWorkbook(
  buffer: ArrayBuffer,
  scopedFacilityId: string,
  user: { id: string; role: string },
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
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
  const canClose = hasPermission(user.role as never, "qa.manage");
  const rowCount = Math.max(0, sheet.rowCount - 1);
  if (rowCount > MAX_ROWS) {
    throw new HttpError(400, `Workbook exceeds ${MAX_ROWS} incident rows`);
  }

  const existing = await prisma.incident.findMany({
    where: { facilityId: facility.id, archivedAt: null },
    select: { id: true, description: true, title: true, reportedAt: true, incidentNumber: true },
  });
  const existingKeys = new Map(
    existing.map((row) => [
      dupKey(facility.id, row.description || row.title, row.reportedAt),
      row.incidentNumber || row.id,
    ]),
  );

  const preview: ImportPreviewRow[] = [];
  const seenInFile = new Map<string, number>();

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

    const entry: ImportPreviewRow = {
      row: index,
      incident: incidentText,
      status: statusMapped,
      dateReported: reportedRaw,
      branch: branchName || null,
      branchId: null,
      priority: priorityRaw,
      assigneeEmail: assigneeEmail || null,
      assigneeId: null,
      dueDate: dueDateRaw || null,
    };

    if (!incidentText || !statusRaw || !reportedRaw) {
      entry.error = "Incident, Status, and DateReported are required";
      preview.push(entry);
      continue;
    }
    if (!INCIDENT_STATUSES.includes(statusMapped as IncidentStatus)) {
      entry.error = "Status must be NEW, IN_PROGRESS, ON_HOLD, REOPENED, or CLOSED";
      preview.push(entry);
      continue;
    }
    if (statusMapped === "CLOSED" && !canClose) {
      entry.error = "Only PM/QA can import Closed incidents";
      preview.push(entry);
      continue;
    }
    if (!PRIORITIES.has(priorityRaw)) {
      entry.error = "Priority must be LOW, MEDIUM, HIGH, or CRITICAL";
      preview.push(entry);
      continue;
    }
    const reportedAt = new Date(reportedRaw);
    if (Number.isNaN(reportedAt.getTime())) {
      entry.error = "DateReported is not a valid date";
      preview.push(entry);
      continue;
    }
    entry.dateReported = reportedAt.toISOString();

    if (facility.branches.length > 0 && !branchName) {
      entry.error = "This facility has branches — include a Branch column value";
      preview.push(entry);
      continue;
    }
    const branch = branchName
      ? facility.branches.find((row) => row.name.toLowerCase() === branchName.toLowerCase())
      : null;
    if (branchName && !branch) {
      entry.error = `Unknown branch ${branchName}`;
      preview.push(entry);
      continue;
    }
    entry.branchId = branch?.id || null;

    const assigneeId = assigneeEmail ? userByEmail.get(assigneeEmail) : null;
    if (assigneeEmail && !assigneeId) {
      entry.error = `Unknown assignee ${assigneeEmail}`;
      preview.push(entry);
      continue;
    }
    entry.assigneeId = assigneeId || null;

    const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
    if (dueDateRaw && Number.isNaN(dueDate?.getTime())) {
      entry.error = "DueDate is not a valid date";
      preview.push(entry);
      continue;
    }
    if (dueDate) entry.dueDate = dueDate.toISOString();

    const key = dupKey(facility.id, incidentText, reportedAt);
    const fileDup = seenInFile.get(key);
    if (fileDup) {
      entry.duplicate = true;
      entry.duplicateOf = `row ${fileDup}`;
      entry.error = `Duplicate of row ${fileDup} in this file`;
    } else {
      seenInFile.set(key, index);
      const existingId = existingKeys.get(key);
      if (existingId) {
        entry.duplicate = true;
        entry.duplicateOf = existingId;
        entry.error = `Duplicate of existing ${existingId}`;
      }
    }

    preview.push(entry);
  }

  return { facility, preview };
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "incidents.create");
    const limited = await rateLimit(clientKey(request, "incident-import"), 10, 60);
    if (!limited.ok) return json({ error: "Too many import requests" }, 429);

    const form = await request.formData();
    const mode = String(form.get("mode") || "preview");
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

    const { facility, preview } = await parseWorkbook(arrayBuffer, scopedFacilityId, user);
    const valid = preview.filter((row) => !row.error);
    const duplicates = preview.filter((row) => row.duplicate);
    const failed = preview.filter((row) => row.error).map((row) => ({
      row: row.row,
      error: row.error!,
    }));

    if (mode !== "commit") {
      return json({
        mode: "preview",
        facilityId: facility.id,
        facilityName: facility.name,
        branchRequired: facility.branches.length > 0,
        branches: facility.branches.map((row) => ({ id: row.id, name: row.name })),
        rows: preview,
        summary: {
          total: preview.length,
          valid: valid.length,
          failed: failed.length,
          duplicates: duplicates.length,
        },
      });
    }

    if (failed.length) {
      throw new HttpError(
        400,
        `Fix ${failed.length} row error(s) / duplicate(s) before committing`,
      );
    }

    const created: string[] = [];
    const meta = requestMeta(request);
    for (const row of valid) {
      const incident = await prisma.$transaction(async (tx) => {
        const reportedAt = new Date(row.dateReported);
        const incidentNumber = await allocateIncidentNumber(tx, reportedAt);
        const next = await tx.incident.create({
          data: {
            ...incidentRecordFields({ description: row.incident }),
            incidentNumber,
            facilityId: facility.id,
            branchId: row.branchId,
            reporterId: user.id,
            priority: row.priority as IncidentPriority,
            assigneeId: row.assigneeId,
            dueDate: row.dueDate ? new Date(row.dueDate) : null,
            reportedAt,
            status: row.status as IncidentStatus,
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
          newValue: { facilityId: facility.id, row: row.row, incidentNumber },
          ...meta,
        });
        return next;
      });
      created.push(incident.id);
    }

    if (created.length) {
      await refreshFacilityHealth(facility.id);
    }

    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        userId: user.id,
        action: "incidents.imported",
        entityType: "Incident",
        entityId: created[0] || "none",
        newValue: { created: created.length, failed: 0, fileName: file.name },
        ...meta,
      });
    });

    return json({ mode: "commit", created: created.length, failed: [], ids: created }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
