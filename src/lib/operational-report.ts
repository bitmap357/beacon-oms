/**
 * Builds the OPERATIONAL report `content` object from incidents + actions in a date window.
 * Used by POST /api/reports/generate. Narrative keys match REPORT_SECTIONS.OPERATIONAL;
 * incidentRows / actionRows / summaryMeta / unitsEngaged are extra structured fields for the print template.
 */
import { prisma } from "@/lib/db";
import { formatContact, formatDate, incidentLabel, labelize } from "@/lib/utils";
import { OPEN_ACTION_STATUSES, isClosedIncidentStatus, isOpenIncidentStatus, labelIncidentStatus } from "@/lib/incident-status";

const OPEN_ACTIONS = OPEN_ACTION_STATUSES;

export async function buildOperationalReport(input: {
  facilityId: string;
  branchId?: string | null;
  from: Date;
  to: Date;
}) {
  const facility = await prisma.facility.findUnique({
    where: { id: input.facilityId },
    include: {
      clientOrganization: true,
      branches: { orderBy: { name: "asc" } },
      assignments: {
        where: { isActive: true },
        include: { user: { select: { name: true, role: true } } },
      },
    },
  });
  if (!facility) return null;

  const incidentWhere = {
    facilityId: input.facilityId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    createdAt: { gte: input.from, lte: input.to },
  };
  const actionWhere = {
    facilityId: input.facilityId,
    createdAt: { gte: input.from, lte: input.to },
    ...(input.branchId
      ? { incident: { is: { branchId: input.branchId } } }
      : {}),
  };

  const [incidents, actions, branch] = await Promise.all([
    prisma.incident.findMany({
      where: incidentWhere,
      include: { branch: true, assignee: true, actions: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.action.findMany({
      where: actionWhere,
      include: { owner: true, incident: true },
      orderBy: { dueDate: "asc" },
    }),
    input.branchId
      ? prisma.facilityBranch.findUnique({ where: { id: input.branchId } })
      : Promise.resolve(null),
  ]);

  const openIncidents = incidents.filter((row) => isOpenIncidentStatus(row.status));
  const closedIncidents = incidents.filter((row) => isClosedIncidentStatus(row.status));
  const overdueActions = actions.filter(
    (row) =>
      row.dueDate < new Date() &&
      OPEN_ACTIONS.includes(row.status as (typeof OPEN_ACTIONS)[number]),
  );
  const completedActions = actions.filter((row) => row.status === "COMPLETED");
  const withoutActions = incidents.filter((row) => row.actions.length === 0);

  const byPriority = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((priority) => {
    const count = incidents.filter((row) => row.priority === priority).length;
    return `${labelize(priority)}: ${count}`;
  });

  const keyIncidents = incidents
    .filter((row) => row.priority === "CRITICAL" || row.priority === "HIGH")
    .slice(0, 8)
    .map((row) => `${incidentLabel(row)} (${labelIncidentStatus(row.status)})`)
    .join("\n");

  const outstanding = overdueActions
    .slice(0, 10)
    .map((row) => `${row.title} — ${row.owner.name} (due ${formatDate(row.dueDate)})`)
    .join("\n");

  const recommendations = [
    overdueActions.length
      ? `${overdueActions.length} overdue action(s) need owners to close or replan.`
      : "No overdue actions in this period.",
    withoutActions.length
      ? `${withoutActions.length} incident(s) still have no follow-up action.`
      : "Every incident in this period has at least one action.",
    openIncidents.filter((row) => row.priority === "CRITICAL").length
      ? "Critical open incidents should be reviewed before the next visit."
      : "No critical incidents remain open in this window.",
  ].join(" ");

  const branchLabel = branch?.name || "All branches";
  const period = `${formatDate(input.from)} – ${formatDate(input.to)}`;
  const personnel = [...new Set(facility.assignments.map((row) => row.user.name))].join(", ") || "See facility assignments";
  const engagedIds = new Set(incidents.map((row) => row.branchId).filter(Boolean));
  const unitSource = facility.branches.length
    ? facility.branches
    : [{ id: null, name: facility.name }];
  const unitsEngaged = unitSource.map((row) => ({
    name: row.name,
    planned: true,
    actual: row.id ? engagedIds.has(row.id) : incidents.length > 0,
  }));

  return {
    facility,
    branchLabel,
    incidents,
    actions,
    content: {
      purpose: `Site visit and incident gathering for ${facility.name} to review operational status, collect outstanding issues, and agree follow-up actions.`,
      period,
      scope: `${facility.clientOrganization.name} · ${facility.name} · ${branchLabel}`,
      summary: `${incidents.length} incident(s) and ${actions.length} action(s) were recorded between ${period}. ${openIncidents.length} incident(s) remain open; ${overdueActions.length} action(s) are overdue.`,
      observations: `Work in this period covered ${incidents.length} incident(s) (${openIncidents.length} still open) and ${actions.length} action(s) (${overdueActions.length} overdue).`,
      incidentCount: String(incidents.length),
      openIncidents: String(openIncidents.length),
      closedIncidents: String(closedIncidents.length),
      actionCount: String(actions.length),
      overdueActions: String(overdueActions.length),
      completedActions: String(completedActions.length),
      incidentsByPriority: byPriority.join(" · "),
      incidentsByFacility: facility.name,
      keyIncidents: keyIncidents || "None",
      outstandingActions: outstanding || "None",
      recommendations,
      nextSteps: overdueActions.length
        ? "Schedule a review with action owners to close or replan overdue items, then confirm the next visit date with the facility lead."
        : "Confirm the next visit date with the facility lead and continue routine monitoring.",
      conclusion: `This report summarises incidents and actions recorded at ${facility.name} between ${period}. ${openIncidents.length} incident(s) remain open at the time of writing.`,
      contact:
        formatContact(facility.contactPerson || facility.contactInfo, facility.contactPhone, facility.contactEmail) ||
        "See the facility record in Beacon for contact details.",
      summaryMeta: {
        vendor: "Beacon OMS",
        client: facility.clientOrganization.name,
        facility: facility.name,
        visitDate: period,
        departments: branchLabel,
        personnel,
        compiledBy: "Beacon OMS",
      },
      unitsEngaged,
      incidentRows: incidents.map((row) => ({
        unit: row.branch?.name || facility.name,
        issue: incidentLabel(row),
        dateReported: formatDate(row.reportedAt || row.createdAt),
        status: labelIncidentStatus(row.status),
        priority: labelize(row.priority),
      })),
      actionRows: actions.map((row) => ({
        title: row.title,
        owner: row.owner.name,
        due: formatDate(row.dueDate),
        status: labelize(row.status),
      })),
    },
  };
}
