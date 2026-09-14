/** POST Excel/CSV incident import. */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess, getAccessibleFacilityIds } from "@/lib/permissions";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import type { IncidentPriority } from "@/lib/db-types";

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

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "incidents.create");
    const limited = await rateLimit(clientKey(request, "incident-import"), 10, 60);
    if (!limited.ok) return json({ error: "Too many import requests" }, 429);

    const form = await request.formData();
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

    const header = sheet.getRow(1);
    const expected = [
      "Facility",
      "Branch",
      "Title",
      "Description",
      "Priority",
      "AssigneeEmail",
      "DueDate",
    ];
    const headings = expected.map((_, index) => cell(header, index + 1).toLowerCase());
    if (headings[0] !== "facility" || headings[2] !== "title") {
      throw new HttpError(
        400,
        "First row must be: Facility, Branch, Title, Description, Priority, AssigneeEmail, DueDate",
      );
    }

    const accessible = await getAccessibleFacilityIds(user);
    const facilities = await prisma.facility.findMany({
      where: { id: { in: accessible } },
      include: { branches: true },
    });
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });
    const facilityByName = new Map(facilities.map((row) => [row.name.trim().toLowerCase(), row]));
    const userByEmail = new Map(users.map((row) => [row.email.toLowerCase(), row.id]));

    const created: string[] = [];
    const failed: Array<{ row: number; error: string }> = [];
    const meta = requestMeta(request);
    const rowCount = Math.max(0, sheet.rowCount - 1);
    if (rowCount > MAX_ROWS) {
      throw new HttpError(400, `Workbook exceeds ${MAX_ROWS} incident rows`);
    }

    for (let index = 2; index <= sheet.rowCount; index += 1) {
      const excelRow = sheet.getRow(index);
      const facilityName = cell(excelRow, 1);
      const branchName = cell(excelRow, 2);
      const title = cell(excelRow, 3);
      const description = cell(excelRow, 4);
      const priorityRaw = cell(excelRow, 5).toUpperCase();
      const assigneeEmail = cell(excelRow, 6).toLowerCase();
      const dueDateRaw = cell(excelRow, 7);
      if (!facilityName && !title) continue;
      if (!facilityName || !title || !description) {
        failed.push({ row: index, error: "Facility, Title, and Description are required" });
        continue;
      }
      const facility = facilityByName.get(facilityName.toLowerCase());
      if (!facility) {
        failed.push({ row: index, error: `Unknown facility: ${facilityName}` });
        continue;
      }
      try {
        await assertFacilityAccess(user, facility.id);
      } catch {
        failed.push({ row: index, error: `No access to ${facilityName}` });
        continue;
      }
      if (!PRIORITIES.has(priorityRaw)) {
        failed.push({ row: index, error: "Priority must be LOW, MEDIUM, HIGH, or CRITICAL" });
        continue;
      }
      const branch = branchName
        ? facility.branches.find((row) => row.name.toLowerCase() === branchName.toLowerCase())
        : null;
      if (branchName && !branch) {
        failed.push({ row: index, error: `Unknown branch ${branchName} for ${facilityName}` });
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
            title,
            facilityId: facility.id,
            branchId: branch?.id || null,
            description,
            reporterId: user.id,
            priority: priorityRaw as IncidentPriority,
            assigneeId: assigneeId || null,
            dueDate,
            status: assigneeId ? "ASSIGNED" : "NEW",
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
          newValue: { title: next.title, facilityId: facility.id, row: index },
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
