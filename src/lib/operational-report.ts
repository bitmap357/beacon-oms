/**
 * Builds the OPERATIONAL report `content` object from incidents + actions in a date window.
 * Used by POST /api/reports/generate. Section keys must match REPORT_SECTIONS.OPERATIONAL.
 */
import { prisma } from "@/lib/db";
import { labelize } from "@/lib/utils";

const OPEN = ["NEW", "ASSIGNED", "IN_PROGRESS", "AWAITING_QA", "REOPENED"] as const;
const OPEN_ACTIONS = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] as const;

export async function buildOperationalReport(input: {
  facilityId: string;
  branchId?: string | null;
  from: Date;
  to: Date;
}) {
  const facility = await prisma.facility.findUnique({
    where: { id: input.facilityId },
    include: { clientOrganization: true, branches: true },
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

  const openIncidents = incidents.filter((row) =>
    OPEN.includes(row.status as (typeof OPEN)[number]),
  );
  const closedIncidents = incidents.filter(
    (row) => row.status === "CLOSED" || row.status === "RESOLVED",
  );
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
    .map((row) => `${row.title} (${labelize(row.status)})`)
    .join("\n");

  const outstanding = overdueActions
    .slice(0, 10)
    .map((row) => `${row.title} — ${row.owner.name} (due ${row.dueDate.toDateString()})`)
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
  const period = `${input.from.toDateString()} – ${input.to.toDateString()}`;

  return {
    facility,
    branchLabel,
    incidents,
    actions,
    content: {
      period,
      scope: `${facility.clientOrganization.name} · ${facility.name} · ${branchLabel}`,
      summary: `${incidents.length} incident(s) and ${actions.length} action(s) were recorded between ${period}. ${openIncidents.length} incident(s) remain open; ${overdueActions.length} action(s) are overdue.`,
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
    },
  };
}
