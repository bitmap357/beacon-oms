/** GET /api/export/[kind] — Excel of the currently filtered list. */
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, requireApiPermission, requireApiUser } from "@/lib/http";
import {
  getScopedFacilityIds,
} from "@/lib/permissions";
import { excelResponse, isoDay } from "@/lib/excel-export";
import {
  OPEN_ACTION_STATUSES,
  OPEN_INCIDENT_STATUS_QUERY,
  dateRange,
  incidentStatusesForFilter,
  labelIncidentStatus,
  reportedAtFilter,
} from "@/lib/incident-status";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { formatRole, incidentLabel, labelize } from "@/lib/utils";
import { labelActivityType } from "@/lib/activity-types";
import { clientKey, rateLimit } from "@/lib/rate-limit";

function pick(url: URL, key: string) {
  return url.searchParams.get(key) || "";
}

function scopedIds(all: string[], facilityId: string) {
  if (facilityId && all.includes(facilityId)) return [facilityId];
  return all;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string }> },
) {
  try {
    const user = await requireApiUser();
    const limited = await rateLimit(clientKey(request, "list-export"), 20, 60);
    if (!limited.ok) throw new HttpError(429, "Too many export requests");
    const { kind } = await context.params;
    const url = new URL(request.url);
    const scope = pick(url, "scope") || undefined;
    const ids = await getScopedFacilityIds(user, scope);
    const facilityId = pick(url, "facilityId");
    const from = pick(url, "from") || null;
    const to = pick(url, "to") || null;
    const range = dateRange(from, to);
    const q = pick(url, "q").trim();

    if (kind === "actions") {
      const ownerId = pick(url, "ownerId");
      const status = pick(url, "status");
      const overdue = pick(url, "overdue") === "1";
      const now = new Date();
      const rows = await prisma.action.findMany({
        where: {
          facilityId: { in: scopedIds(ids, facilityId) },
          ...(pick(url, "incidentId") ? { incidentId: pick(url, "incidentId") } : {}),
          ...(pick(url, "mine") === "1" ? { ownerId: user.id } : {}),
          ...(ownerId ? { ownerId } : {}),
          ...(status ? { status } : {}),
          ...(range ? { dueDate: range } : {}),
          ...(overdue ? { dueDate: { lt: now }, status: { in: [...OPEN_ACTION_STATUSES] } } : {}),
        },
        include: { facility: true, owner: true, incident: true },
        orderBy: { dueDate: "asc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-actions.xlsx",
        "Actions",
        ["Action", "Incident", "Facility", "Owner", "Due", "Status", "Priority"],
        rows.map((row) => [
          row.title,
          row.incident ? incidentLabel(row.incident) : "",
          row.facility.name,
          row.owner.name,
          isoDay(row.dueDate),
          labelize(row.status),
          labelize(row.priority),
        ]),
      );
    }

    if (kind === "facilities") {
      const status = pick(url, "status");
      const organizationId = pick(url, "organizationId");
      const attention = ["ATTENTION_REQUIRED", "AT_RISK", "CRITICAL"];
      const rows = await prisma.facility.findMany({
        where: {
          id: { in: ids },
          ...(organizationId ? { clientOrganizationId: organizationId } : {}),
          ...(q ? { name: { contains: q } } : {}),
          ...(status === "attention" ? { status: { in: attention } } : {}),
          ...(status && status !== "attention" ? { status } : {}),
        },
        include: {
          clientOrganization: true,
          branches: true,
          assignments: { where: { isActive: true, isLead: true }, include: { user: true } },
        },
        orderBy: { name: "asc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-facilities.xlsx",
        "Facilities",
        ["Facility", "Organization", "Location", "Contact person", "Branches", "Lead PM/QA", "Lead Developer", "Status"],
        rows.map((row) => [
          row.name,
          row.clientOrganization.name,
          row.location || "",
          row.contactPerson || row.contactInfo || "",
          row.branches.map((branch) => branch.name).join("; "),
          row.assignments.find((assignment) => assignment.assignmentType === "PM_QA")?.user.name || "",
          row.assignments.find((assignment) => assignment.assignmentType === "DEVELOPER")?.user.name || "",
          labelize(row.status),
        ]),
      );
    }

    if (kind === "qa-queue") {
      const assigneeId = pick(url, "assigneeId");
      const statusValues = incidentStatusesForFilter("COMPLETED") || ["COMPLETED"];
      const rows = await prisma.incident.findMany({
        where: {
          facilityId: { in: scopedIds(ids, facilityId) },
          status: { in: statusValues },
          ...(assigneeId ? { assigneeId } : {}),
          ...(range ? { resolvedAt: range } : {}),
        },
        include: { facility: true, branch: true, assignee: true },
        orderBy: { resolvedAt: "desc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-qa-queue.xlsx",
        "Awaiting QA",
        ["Incident", "Facility", "Branch", "Assignee", "Completed", "Priority"],
        rows.map((row) => [
          incidentLabel(row),
          row.facility.name,
          row.branch?.name || "",
          row.assignee?.name || "",
          isoDay(row.resolvedAt),
          labelize(row.priority),
        ]),
      );
    }

    if (kind === "qa") {
      const result = pick(url, "result");
      const qaUserId = pick(url, "qaUserId");
      const rows = await prisma.qARecord.findMany({
        where: {
          facilityId: { in: scopedIds(ids, facilityId) },
          ...(result ? { result } : {}),
          ...(qaUserId ? { qaUserId } : {}),
          ...(range ? { qaDate: range } : {}),
        },
        include: { facility: true, qaUser: true, relatedIncident: true },
        orderBy: { qaDate: "desc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-qa.xlsx",
        "QA records",
        ["Facility", "Result", "QA person", "Date", "Incident", "Findings"],
        rows.map((row) => [
          row.facility.name,
          labelize(row.result),
          row.qaUser.name,
          isoDay(row.qaDate),
          row.relatedIncident ? incidentLabel(row.relatedIncident) : "",
          row.findings || "",
        ]),
      );
    }

    if (kind === "reports") {
      const type = pick(url, "type");
      const status = pick(url, "status");
      const authorId = pick(url, "authorId");
      const rows = await prisma.report.findMany({
        where: {
          facilityId: { in: scopedIds(ids, facilityId) },
          ...(type ? { type } : {}),
          ...(status ? { status } : {}),
          ...(authorId ? { authorId } : {}),
          ...(range ? { date: range } : {}),
        },
        include: { facility: true, author: true },
        orderBy: { date: "desc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-reports.xlsx",
        "Reports",
        ["Type", "Facility", "Date", "Author", "Status"],
        rows.map((row) => [
          labelize(row.type),
          row.facility.name,
          isoDay(row.date),
          row.author.name,
          labelize(row.status),
        ]),
      );
    }

    if (kind === "handovers") {
      const fromUserId = pick(url, "fromUserId");
      const toUserId = pick(url, "toUserId");
      const rows = await prisma.handover.findMany({
        where: {
          facilityId: { in: scopedIds(ids, facilityId) },
          ...(fromUserId ? { fromUserId } : {}),
          ...(toUserId ? { toUserId } : {}),
          ...(range ? { createdAt: range } : {}),
        },
        include: { facility: true, fromUser: true, toUser: true, initiatedBy: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-handovers.xlsx",
        "Handovers",
        ["Facility", "From", "To", "Initiated by", "Date"],
        rows.map((row) => [
          row.facility.name,
          row.fromUser?.name || "",
          row.toUser?.name || "",
          row.initiatedBy.name,
          isoDay(row.createdAt),
        ]),
      );
    }

    if (kind === "visits-due") {
      const organizationId = pick(url, "organizationId");
      const recommendation = pick(url, "recommendation");
      const facilities = await prisma.facility.findMany({
        where: {
          id: { in: scopedIds(ids, facilityId) },
          ...(organizationId ? { clientOrganizationId: organizationId } : {}),
        },
        include: { clientOrganization: true },
        orderBy: { name: "asc" },
      });
      const rows = [];
      for (const facility of facilities) {
        const rec = await calculateVisitRecommendation(facility.id);
        if (rec.recommendation === "NOT_DUE") continue;
        if (recommendation && rec.recommendation !== recommendation) continue;
        rows.push({ facility, rec });
      }
      return excelResponse(
        "beacon-visits-due.xlsx",
        "Visits due",
        ["Facility", "Organization", "Recommendation", "Days since last visit", "Why"],
        rows.map(({ facility, rec }) => [
          facility.name,
          facility.clientOrganization.name,
          labelize(rec.recommendation),
          rec.daysSinceLastVisit ?? "",
          rec.reason || "",
        ]),
      );
    }

    if (kind === "notifications") {
      const type = pick(url, "type");
      const unread = pick(url, "unread") === "1";
      const rows = await prisma.notification.findMany({
        where: {
          userId: user.id,
          ...(type ? { type } : {}),
          ...(unread ? { isRead: false } : {}),
          ...(range ? { createdAt: range } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-notifications.xlsx",
        "Notifications",
        ["Message", "Type", "Read", "Date"],
        rows.map((row) => [
          row.message,
          labelize(row.type),
          row.isRead ? "Read" : "Unread",
          isoDay(row.createdAt),
        ]),
      );
    }

    if (kind === "audit") {
      requireApiPermission(user, "audit.read");
      const action = pick(url, "action");
      const entityType = pick(url, "entityType");
      const userId = pick(url, "userId");
      const rows = await prisma.auditLog.findMany({
        where: {
          ...(action ? { action: { contains: action } } : {}),
          ...(entityType ? { entityType } : {}),
          ...(userId ? { userId } : {}),
          ...(range ? { createdAt: range } : {}),
        },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-audit.xlsx",
        "Audit",
        ["When", "Who", "Email", "Action", "Entity", "Entity ID", "Previous", "Next", "IP"],
        rows.map((row) => [
          row.createdAt.toISOString(),
          row.user?.name || "System",
          row.user?.email || "",
          row.action,
          row.entityType,
          row.entityId,
          row.previousValue || "",
          row.newValue || "",
          row.ipAddress || "",
        ]),
      );
    }

    if (kind === "users") {
      requireApiPermission(user, "users.read");
      const role = pick(url, "role");
      const status = pick(url, "status");
      const rows = await prisma.user.findMany({
        where: {
          ...(role ? { role } : {}),
          ...(status === "active" ? { isActive: true } : {}),
          ...(status === "inactive" ? { isActive: false } : {}),
          ...(q
            ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
            : {}),
        },
        orderBy: { name: "asc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-users.xlsx",
        "Users",
        ["Name", "Email", "Role", "Status", "Last login"],
        rows.map((row) => [
          row.name,
          row.email,
          formatRole(row.role),
          row.isActive ? "Active" : "Deactivated",
          isoDay(row.lastLoginAt),
        ]),
      );
    }

    if (kind === "organizations") {
      requireApiPermission(user, "orgs.read");
      const rows = await prisma.clientOrganization.findMany({
        where: q ? { name: { contains: q } } : {},
        include: {
          facilities: { include: { branches: true }, orderBy: { name: "asc" } },
        },
        orderBy: { name: "asc" },
      });
      const flat = [];
      for (const org of rows) {
        if (org.facilities.length === 0) {
          flat.push([org.name, "", "", "", ""]);
          continue;
        }
        for (const facility of org.facilities) {
          if (facility.branches.length === 0) {
            flat.push([
              org.name,
              facility.name,
              facility.location || "",
              facility.contactPerson || facility.contactInfo || "",
              "",
            ]);
            continue;
          }
          for (const branch of facility.branches) {
            flat.push([
              org.name,
              facility.name,
              facility.location || "",
              branch.contactPerson || facility.contactPerson || "",
              branch.name,
            ]);
          }
        }
      }
      return excelResponse(
        "beacon-organizations.xlsx",
        "Organizations",
        ["Organization", "Facility", "Location", "Contact person", "Branch"],
        flat,
      );
    }

    if (kind === "analytics") {
      requireApiPermission(user, "analytics.view");
      const team = await prisma.user.findMany({
        where: {
          role: { in: ["PM_QA", "DEVELOPER"] },
          isActive: true,
          ...(q ? { name: { contains: q } } : {}),
        },
        select: { id: true, name: true },
      });
      const rows = [];
      for (const member of team) {
        const [assigned, openIncidents, openActions, overdue, activityVolume] = await Promise.all([
          prisma.facilityAssignment.count({ where: { userId: member.id, isActive: true } }),
          prisma.incident.count({
            where: { assigneeId: member.id, status: { in: [...OPEN_INCIDENT_STATUS_QUERY] } },
          }),
          prisma.action.count({
            where: { ownerId: member.id, status: { in: [...OPEN_ACTION_STATUSES] } },
          }),
          prisma.action.count({
            where: {
              ownerId: member.id,
              dueDate: { lt: new Date() },
              status: { in: [...OPEN_ACTION_STATUSES] },
            },
          }),
          prisma.activity.count({ where: { responsibleUserId: member.id } }),
        ]);
        rows.push([member.name, assigned, openIncidents, openActions, overdue, activityVolume]);
      }
      return excelResponse(
        "beacon-analytics-team.xlsx",
        "Team insights",
        ["Person", "Facilities", "Open incidents", "Open actions", "Overdue", "Activity volume"],
        rows,
      );
    }

    if (kind === "search") {
      if (q.length < 2) {
        return excelResponse("beacon-search.xlsx", "Search", ["Type", "Title"], []);
      }
      const [facilities, incidents, actions, reports, users, activities] = await Promise.all([
        prisma.facility.findMany({
          where: { id: { in: ids }, name: { contains: q } },
          take: 50,
        }),
        prisma.incident.findMany({
          where: {
            facilityId: { in: ids },
            OR: [{ description: { contains: q } }, { title: { contains: q } }],
          },
          take: 50,
        }),
        prisma.action.findMany({
          where: { facilityId: { in: ids }, title: { contains: q } },
          take: 50,
        }),
        prisma.report.findMany({
          where: { facilityId: { in: ids }, OR: [{ type: { contains: q } }, { status: { contains: q } }] },
          take: 50,
        }),
        prisma.user.findMany({
          where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] },
          take: 50,
        }),
        prisma.activity.findMany({
          where: { facilityId: { in: ids }, description: { contains: q } },
          take: 50,
        }),
      ]);
      return excelResponse("beacon-search.xlsx", "Search", ["Type", "Title"], [
        ...facilities.map((row) => ["Facility", row.name]),
        ...incidents.map((row) => ["Incident", incidentLabel(row)]),
        ...actions.map((row) => ["Action", row.title]),
        ...reports.map((row) => ["Report", labelize(row.type)]),
        ...users.map((row) => ["Person", row.name]),
        ...activities.map((row) => ["Activity", labelActivityType(row.type)]),
      ]);
    }

    if (kind === "calendar") {
      const userId = pick(url, "userId");
      const month = pick(url, "month");
      const now = new Date();
      const [yearStr, monthStr] = (month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const start = new Date(year, monthIndex, 1);
      start.setDate(start.getDate() - start.getDay() - 7);
      const end = new Date(year, monthIndex + 1, 14);
      const calendarIds = scopedIds(ids, facilityId);
      const [activities, actions] = await Promise.all([
        prisma.activity.findMany({
          where: {
            facilityId: { in: calendarIds },
            date: { gte: start, lt: end },
            ...(userId
              ? {
                  OR: [
                    { responsibleUserId: userId },
                    { participants: { some: { userId } } },
                  ],
                }
              : {}),
          },
          include: { facility: true, responsibleUser: true },
          orderBy: { date: "asc" },
          take: 5000,
        }),
        prisma.action.findMany({
          where: {
            facilityId: { in: calendarIds },
            dueDate: { gte: start, lt: end },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            ...(userId ? { ownerId: userId } : {}),
          },
          include: { facility: true, owner: true },
          orderBy: { dueDate: "asc" },
          take: 5000,
        }),
      ]);
      return excelResponse(
        "beacon-calendar.xlsx",
        "Calendar",
        ["Kind", "Title", "Facility", "When", "Person"],
        [
          ...activities.map((row) => [
            labelActivityType(row.type),
            row.description || labelActivityType(row.type),
            row.facility.name,
            isoDay(row.startTime || row.date),
            row.responsibleUser.name,
          ]),
          ...actions.map((row) => [
            "Action",
            row.title,
            row.facility.name,
            isoDay(row.dueDate),
            row.owner.name,
          ]),
        ],
      );
    }

    if (kind === "incidents") {
      const status = pick(url, "status");
      const statusValues = incidentStatusesForFilter(status || null);
      const dates = reportedAtFilter(from, to);
      const withoutActions = pick(url, "withoutActions") === "1";
      const rows = await prisma.incident.findMany({
        where: {
          facilityId: { in: scopedIds(ids, facilityId) },
          ...(pick(url, "mine") === "1" ? { assigneeId: user.id } : {}),
          ...(pick(url, "assigneeId") ? { assigneeId: pick(url, "assigneeId") } : {}),
          ...(statusValues ? { status: { in: statusValues } } : {}),
          ...(pick(url, "priority") ? { priority: pick(url, "priority") as never } : {}),
          ...(dates || {}),
          ...(withoutActions
            ? {
                ...(!status ? { status: { in: [...OPEN_INCIDENT_STATUS_QUERY] } } : {}),
                actions: { none: {} },
              }
            : {}),
        },
        include: {
          facility: true,
          branch: true,
          assignee: true,
          reporter: true,
        },
        orderBy: { reportedAt: "desc" },
        take: 5000,
      });
      return excelResponse(
        "beacon-incidents.xlsx",
        "Incidents",
        [
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
        ],
        rows.map((row) => [
          incidentLabel(row),
          row.facility.name,
          row.branch?.name || "",
          labelIncidentStatus(row.status),
          labelize(row.priority),
          row.assignee?.name || "",
          row.reporter.name,
          isoDay(row.reportedAt),
          isoDay(row.dueDate),
          isoDay(row.closedAt),
        ]),
      );
    }

    throw new HttpError(404, "Unknown export");
  } catch (error) {
    return errorResponse(error);
  }
}
