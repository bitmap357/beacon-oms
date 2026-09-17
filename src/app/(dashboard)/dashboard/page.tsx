/**
 * Home operational picture: metrics, charts (with ChartKey legends), tables.
 * Chart colours: FACILITY_HEALTH_HEX / incidentStatusHex / actionStatusHex (same tones as pills).
 */
import Link from "next/link";
import { Card, MetricCard } from "@/components/ui/card";
import { StatusPill, PriorityPill, FACILITY_HEALTH_HEX, incidentStatusHex, actionStatusHex, TONE_HEX } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ColumnChart, DonutChart, HorizontalBarChart, LineChart, ChartKey } from "@/components/charts";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getScopedFacilityIds } from "@/lib/permissions";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { formatDate, incidentLabel, labelize } from "@/lib/utils";
import { ScopeFilter } from "@/components/scope-filter";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { IllustratedEmpty } from "@/components/empty-state";
import { OPEN_ACTION_STATUSES, OPEN_INCIDENT_STATUS_QUERY, mergeStatusCounts, labelIncidentStatus } from "@/lib/incident-status";
import {
  Building2,
  GitBranch,
  HeartPulse,
  Siren,
  AlertTriangle,
  ClipboardCheck,
  CircleAlert,
  CalendarDays,
  MapPin,
  ShieldCheck,
  FileText,
} from "lucide-react";

const OPEN = OPEN_INCIDENT_STATUS_QUERY;
const OPEN_ACTIONS = OPEN_ACTION_STATUSES;

function weekStart(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function weekKey(date: Date) {
  const start = weekStart(date);
  return `${start.getMonth() + 1}/${start.getDate()}`;
}

function todayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireUser();
  const { scope } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const now = new Date();
  const weekStartDate = weekStart(now);
  const lookback = new Date(now);
  lookback.setDate(now.getDate() - 84);

  const [
    totalFacilities,
    branchCount,
    activeFacilities,
    attention,
    openIncidents,
    criticalIncidents,
    overdueActions,
    activitiesThisWeek,
    pendingQa,
    incidentsWithoutActions,
    reportsThisMonth,
    health,
    incidentStatus,
    incidentPriority,
    actionStatus,
    facilities,
    recentIncidents,
    openIncidentRows,
    overdueActionRows,
  ] = await Promise.all([
    prisma.facility.count({ where: { id: { in: ids } } }),
    prisma.facilityBranch.count({ where: { facilityId: { in: ids } } }),
    prisma.facility.count({ where: { id: { in: ids }, status: { not: "INACTIVE" } } }),
    prisma.facility.count({
      where: { id: { in: ids }, status: { in: ["ATTENTION_REQUIRED", "AT_RISK", "CRITICAL"] } },
    }),
    prisma.incident.count({ where: { facilityId: { in: ids }, archivedAt: null, status: { in: [...OPEN] } } }),
    prisma.incident.count({
      where: { facilityId: { in: ids }, archivedAt: null, status: { in: [...OPEN] }, priority: "CRITICAL" },
    }),
    prisma.action.count({
      where: {
        facilityId: { in: ids },
        dueDate: { lt: now },
        status: { in: [...OPEN_ACTIONS] },
      },
    }),
    prisma.activity.count({ where: { facilityId: { in: ids }, date: { gte: weekStartDate } } }),
    prisma.qARecord.count({
      where: { facilityId: { in: ids }, result: { in: ["FAILED", "REQUIRES_RETEST"] } },
    }),
    prisma.incident.count({
      where: { facilityId: { in: ids }, archivedAt: null, status: { in: [...OPEN] }, actions: { none: {} } },
    }),
    prisma.report.count({
      where: {
        facilityId: { in: ids },
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    }),
    prisma.facility.groupBy({
      by: ["status"],
      where: { id: { in: ids } },
      _count: { status: true },
    }),
    prisma.incident.groupBy({
      by: ["status"],
      where: { facilityId: { in: ids }, archivedAt: null },
      _count: { status: true },
    }),
    prisma.incident.groupBy({
      by: ["priority"],
      where: { facilityId: { in: ids }, status: { in: [...OPEN] } },
      _count: { priority: true },
    }),
    prisma.action.groupBy({
      by: ["status"],
      where: { facilityId: { in: ids } },
      _count: { status: true },
    }),
    prisma.facility.findMany({
      where: { id: { in: ids } },
      include: {
        clientOrganization: true,
        branches: true,
        _count: {
          select: {
            incidents: { where: { status: { in: [...OPEN] } } },
            actions: { where: { status: { in: [...OPEN_ACTIONS] } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.incident.findMany({
      where: { facilityId: { in: ids }, createdAt: { gte: lookback } },
      select: { createdAt: true, status: true, facilityId: true },
    }),
    prisma.incident.findMany({
      where: {
        facilityId: { in: ids },
        status: { in: [...OPEN] },
        priority: { in: ["CRITICAL", "HIGH"] },
      },
      include: { facility: true, branch: true, assignee: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.action.findMany({
      where: {
        facilityId: { in: ids },
        dueDate: { lt: now },
        status: { in: [...OPEN_ACTIONS] },
      },
      include: { facility: true, owner: true, incident: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
  ]);

  const weekMap = new Map<string, number>();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    weekMap.set(weekKey(d), 0);
  }
  for (const row of recentIncidents) {
    const key = weekKey(row.createdAt);
    if (weekMap.has(key)) weekMap.set(key, (weekMap.get(key) || 0) + 1);
  }

  const hottest = [...facilities].sort(
    (a, b) => b._count.incidents - a._count.incidents,
  )[0];
  const insights = [
    `${openIncidents} open incident${openIncidents === 1 ? "" : "s"} across ${totalFacilities} facilities.`,
    overdueActions
      ? `${overdueActions} action${overdueActions === 1 ? "" : "s"} past due — those are blocking closure.`
      : "No overdue actions right now.",
    incidentsWithoutActions
      ? `${incidentsWithoutActions} open incident${incidentsWithoutActions === 1 ? " still has" : "s still have"} no follow-up action.`
      : "Every open incident has at least one action.",
    hottest && hottest._count.incidents
      ? `${hottest.name} holds the most open work (${hottest._count.incidents} incidents).`
      : "Open work is evenly spread.",
  ];

  const visits = [];
  for (const facility of facilities) {
    const rec = await calculateVisitRecommendation(facility.id);
    if (rec.recommendation !== "NOT_DUE") {
      visits.push({ facility, rec });
    }
  }

  const pmUsers = await prisma.user.findMany({
    where: { role: "PM_QA", isActive: true },
    select: { id: true, name: true },
  });
  const workload = await Promise.all(
    pmUsers.map(async (pm) => {
      const assigned = await prisma.facilityAssignment.findMany({
        where: { userId: pm.id, isActive: true },
        select: { facilityId: true, isLead: true },
      });
      const facilityIds = assigned.map((row) => row.facilityId);
      const [openInc, openAct] = await Promise.all([
        prisma.incident.count({
          where: { facilityId: { in: facilityIds }, status: { in: [...OPEN] } },
        }),
        prisma.action.count({
          where: {
            facilityId: { in: facilityIds },
            status: { in: [...OPEN_ACTIONS] },
          },
        }),
      ]);
      return {
        id: pm.id,
        name: pm.name,
        facilities: assigned.length,
        leadFacilities: assigned.filter((row) => row.isLead).length,
        openIncidents: openInc,
        openActions: openAct,
      };
    }),
  );

  return (
    <div>
      <section className="page-enter mb-8 overflow-hidden rounded-2xl border border-hairline bg-surface-raised">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]">
          <div className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-slate">
              {todayLabel(now)}
            </p>
            <DashboardGreeting name={user.name} />
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate">
              {insights[0]} {insights[1]}
            </p>
            <div className="mt-5">
              <ScopeFilter />
            </div>
          </div>
          <div className="relative h-44 bg-[#f3eee4] sm:h-52 lg:h-auto lg:min-h-[15.5rem] dark:bg-[#10192c]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/illustrations/hero.png"
              alt="Beacon operations overview illustration"
              className="h-full w-full object-cover object-[72%_38%]"
            />
          </div>
        </div>
      </section>
      <section className="mb-5">
        <h2 className="mb-2.5 text-[12px] font-medium uppercase tracking-wide text-slate">Facilities</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Facilities" value={totalFacilities} href="/facilities" icon={Building2} />
          <MetricCard label="Branches" value={branchCount} href="/facilities" icon={GitBranch} />
          <MetricCard label="Active" value={activeFacilities} href="/facilities" icon={HeartPulse} />
          <MetricCard label="Needs attention" value={attention} href="/facilities?status=attention" icon={AlertTriangle} />
        </div>
      </section>
      <section className="mb-5">
        <h2 className="mb-2.5 text-[12px] font-medium uppercase tracking-wide text-slate">Incidents and actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Open incidents" value={openIncidents} href="/incidents?status=open" icon={Siren} />
          <MetricCard label="Critical open" value={criticalIncidents} href="/incidents?status=open&priority=CRITICAL" icon={CircleAlert} />
          <MetricCard label="Overdue actions" value={overdueActions} href="/actions?overdue=1" icon={ClipboardCheck} />
          <MetricCard label="No follow-up" value={incidentsWithoutActions} href="/incidents?withoutActions=1" icon={CircleAlert} />
        </div>
      </section>
      <section className="mb-8">
        <h2 className="mb-2.5 text-[12px] font-medium uppercase tracking-wide text-slate">Activity</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Activities this week" value={activitiesThisWeek} href="/calendar" icon={CalendarDays} />
          <MetricCard label="Visits due" value={visits.length} href="/visits-due" icon={MapPin} />
          <MetricCard label="Pending QA" value={pendingQa} href="/qa" icon={ShieldCheck} />
          <MetricCard label="Reports this month" value={reportsThisMonth} href="/reports" icon={FileText} />
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <Card className="p-5 xl:col-span-2">
          <h2 className="font-heading mb-3 text-[18px]">Incidents opened (12 weeks)</h2>
          <LineChart
            id="incidents-trend"
            categoryField="week"
            valueField="count"
            seriesName="Incidents opened"
            data={[...weekMap.entries()].map(([week, count]) => ({ week, count }))}
          />
          <ChartKey items={[{ label: "Incidents opened", color: TONE_HEX.brand }]} />
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Facility health</h2>
          <DonutChart
            id="health-donut"
            data={health.map((row) => ({
              category: labelize(row.status),
              value: row._count.status,
              color: FACILITY_HEALTH_HEX[row.status as keyof typeof FACILITY_HEALTH_HEX] || TONE_HEX.brand,
            }))}
          />
          <ChartKey
            items={health.map((row) => ({
              label: `${labelize(row.status)} (${row._count.status})`,
              color: FACILITY_HEALTH_HEX[row.status as keyof typeof FACILITY_HEALTH_HEX] || TONE_HEX.brand,
            }))}
          />
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Incidents by status</h2>
          <DonutChart
            id="incident-status"
            data={mergeStatusCounts(incidentStatus).map((row) => ({
              category: labelIncidentStatus(row.status),
              value: row._count.status,
              color: incidentStatusHex(row.status),
              href: `/incidents?status=${row.status}`,
            }))}
          />
          <ChartKey
            items={mergeStatusCounts(incidentStatus).map((row) => ({
              label: `${labelIncidentStatus(row.status)} (${row._count.status})`,
              color: incidentStatusHex(row.status),
              href: `/incidents?status=${row.status}`,
            }))}
          />
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Open incidents by priority</h2>
          <ColumnChart
            id="incident-priority"
            categoryField="priority"
            valueField="count"
            data={incidentPriority.map((row) => ({
              priority: labelize(row.priority),
              count: row._count.priority,
            }))}
          />
          <ChartKey items={[{ label: "Open incidents", color: TONE_HEX.brand }]} />
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Actions by status</h2>
          <DonutChart
            id="action-status"
            data={actionStatus.map((row) => ({
              category: labelize(row.status),
              value: row._count.status,
              color: actionStatusHex(row.status),
            }))}
          />
          <ChartKey
            items={actionStatus.map((row) => ({
              label: `${labelize(row.status)} (${row._count.status})`,
              color: actionStatusHex(row.status),
            }))}
          />
        </Card>
        <Card className="p-5 xl:col-span-3">
          <h2 className="font-heading mb-3 text-[18px]">Open incidents by facility</h2>
          <HorizontalBarChart
            id="incidents-facility"
            categoryField="facility"
            valueField="count"
            data={facilities.map((row) => ({
              facility: row.name,
              count: row._count.incidents,
            }))}
          />
          <ChartKey items={[{ label: "Open incidents", color: TONE_HEX.brand }]} />
        </Card>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-5 xl:gap-6">
        <Card className="p-5 xl:col-span-3">
          <h2 className="font-heading mb-3 text-[18px]">High / critical open incidents</h2>
          {openIncidentRows.length === 0 ? (
            <IllustratedEmpty
              title="No high or critical incidents are open."
              image="/brand/illustrations/page-incidents.png"
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Incident</TH>
                  <TH>Facility</TH>
                  <TH>Priority</TH>
                </TR>
              </THead>
              <TBody>
                {openIncidentRows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link className="text-brand" href={`/incidents/${row.id}`}>
                        {incidentLabel(row)}
                      </Link>
                    </TD>
                    <TD>
                      <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                        {row.facility.name}
                      </Link>
                      {row.branch ? <span className="text-slate"> · {row.branch.name}</span> : null}
                    </TD>
                    <TD>
                      <PriorityPill priority={row.priority} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <Card className="p-5 xl:col-span-2">
          <h2 className="font-heading mb-3 text-[18px]">Overdue actions</h2>
          {overdueActionRows.length === 0 ? (
            <IllustratedEmpty
              title="No overdue actions."
              image="/brand/illustrations/page-actions.png"
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Action</TH>
                  <TH>Incident</TH>
                  <TH>Due</TH>
                </TR>
              </THead>
              <TBody>
                {overdueActionRows.map((row) => (
                  <TR key={row.id}>
                    <TD>{row.title}</TD>
                    <TD>
                      {row.incident ? (
                        <Link className="text-brand" href={`/incidents/${row.incident.id}`}>
                          {incidentLabel(row.incident)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="font-mono text-[12px]">{formatDate(row.dueDate)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2 xl:gap-6">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-heading text-[18px]">Visits due</h2>
            <Link className="text-sm text-brand" href="/visits-due">
              View all
            </Link>
          </div>
          {visits.length === 0 ? (
            <IllustratedEmpty
              title="No facilities currently flagged for a visit."
              image="/brand/illustrations/page-calendar.png"
            />
          ) : (
            <ul className="space-y-3">
              {visits.slice(0, 8).map(({ facility, rec }) => (
                <li key={facility.id} className="flex items-start justify-between gap-3">
                  <div>
                    <Link className="text-brand" href={`/facilities/${facility.id}`}>
                      {facility.name}
                    </Link>
                    <p className="text-[12px] text-slate">{rec.reason}</p>
                  </div>
                  <StatusPill status={facility.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Facility load</h2>
          <Table>
            <THead>
              <TR>
                <TH>Facility</TH>
                <TH>Org</TH>
                <TH>Open incidents</TH>
                <TH>Open actions</TH>
              </TR>
            </THead>
            <TBody>
              {facilities.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <Link className="text-brand" href={`/facilities/${row.id}`}>
                      {row.name}
                    </Link>
                    {row.branches.length ? (
                      <span className="block text-[12px] text-slate">
                        {row.branches.length} branch{row.branches.length === 1 ? "" : "es"}
                      </span>
                    ) : null}
                  </TD>
                  <TD>{row.clientOrganization.name}</TD>
                  <TD>{row._count.incidents}</TD>
                  <TD>{row._count.actions}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Team workload</h2>
        <Table>
          <THead>
            <TR>
              <TH>PM/QA</TH>
              <TH>Facilities</TH>
              <TH>Lead facilities</TH>
              <TH>Open incidents</TH>
              <TH>Open actions</TH>
            </TR>
          </THead>
          <TBody>
            {workload.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link className="text-brand" href={`/profile/${row.id}`}>
                    {row.name}
                  </Link>
                </TD>
                <TD>{row.facilities}</TD>
                <TD>{row.leadFacilities}</TD>
                <TD>{row.openIncidents}</TD>
                <TD>{row.openActions}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
