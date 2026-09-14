/** Cross-facility charts. Permission: analytics.view / analytics.full */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission, getAccessibleFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ColumnChart } from "@/components/charts";
import { labelize } from "@/lib/utils";

export default async function AnalyticsPage() {
  const user = await requireUser();
  assertPermission(user, "analytics.view");
  const ids = await getAccessibleFacilityIds(user);

  const [byPriority, incidents, team] = await Promise.all([
    prisma.incident.groupBy({
      by: ["priority"],
      where: { facilityId: { in: ids } },
      _count: { priority: true },
    }),
    prisma.incident.findMany({
      where: { facilityId: { in: ids } },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["PM_QA", "DEVELOPER"] }, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  const byMonthMap = new Map<string, number>();
  for (const row of incidents) {
    const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, "0")}`;
    byMonthMap.set(key, (byMonthMap.get(key) || 0) + 1);
  }
  const resolved = incidents.filter((row) => row.resolvedAt);
  const avg =
    resolved.length === 0
      ? 0
      : Math.round(
          resolved.reduce(
            (sum, row) =>
              sum + ((row.resolvedAt as Date).getTime() - row.createdAt.getTime()) / 36e5,
            0,
          ) / resolved.length,
        );

  const teamRows = await Promise.all(
    team.map(async (member) => {
      const [assigned, openIncidents, openActions, overdue, activityVolume] = await Promise.all([
        prisma.facilityAssignment.count({ where: { userId: member.id, isActive: true } }),
        prisma.incident.count({
          where: {
            assigneeId: member.id,
            status: { in: ["NEW", "ASSIGNED", "IN_PROGRESS", "AWAITING_QA", "REOPENED"] },
          },
        }),
        prisma.action.count({
          where: {
            ownerId: member.id,
            status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
          },
        }),
        prisma.action.count({
          where: {
            ownerId: member.id,
            dueDate: { lt: new Date() },
            status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
          },
        }),
        prisma.activity.count({ where: { responsibleUserId: member.id } }),
      ]);
      return { ...member, assigned, openIncidents, openActions, overdue, activityVolume };
    }),
  );

  return (
    <div>
      <PageHeader title="Analytics" description="Incident, facility, and team insights." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Incidents over time</h2>
          <ColumnChart
            id="incidents-month"
            categoryField="month"
            valueField="count"
            data={[...byMonthMap.entries()].map(([month, count]) => ({ month, count }))}
          />
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Incidents by priority</h2>
          <ColumnChart
            id="incidents-priority"
            categoryField="priority"
            valueField="count"
            data={byPriority.map((row) => ({
              priority: labelize(row.priority),
              count: row._count.priority,
            }))}
          />
          <p className="mt-3 text-[13px] text-slate">
            Average resolution time: {avg} hours
          </p>
        </Card>
      </div>
      <Card className="mt-4 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Team insights</h2>
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH>Facilities</TH>
              <TH>Open incidents</TH>
              <TH>Open actions</TH>
              <TH>Overdue</TH>
              <TH>Activity volume</TH>
            </TR>
          </THead>
          <TBody>
            {teamRows.map((row) => (
              <TR key={row.id}>
                <TD>{row.name}</TD>
                <TD>{row.assigned}</TD>
                <TD>{row.openIncidents}</TD>
                <TD>{row.openActions}</TD>
                <TD>{row.overdue}</TD>
                <TD>{row.activityVolume}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
