/**
 * Loads activities + open actions for the month (padded for week view) and hands them to CalendarBoard.
 * Query: ?month=YYYY-MM&view=month|week&day=YYYY-MM-DD
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { CalendarBoard, type CalendarEvent } from "@/components/calendar-board";
import { ScopeFilter } from "@/components/scope-filter";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; day?: string; scope?: string }>;
}) {
  const user = await requireUser();
  const { month, view, day, scope } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const now = new Date();
  const [yearStr, monthStr] = (month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const focusDay =
    day ||
    (monthIndex === now.getMonth() && year === now.getFullYear()
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      : `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`);
  const start = new Date(year, monthIndex, 1);
  start.setDate(start.getDate() - start.getDay() - 7);
  const end = new Date(year, monthIndex + 1, 14);

  const [activities, actions, facilities, users] = await Promise.all([
    prisma.activity.findMany({
      where: { facilityId: { in: ids }, date: { gte: start, lt: end } },
      include: {
        facility: true,
        responsibleUser: true,
        reports: { select: { id: true }, take: 1 },
        participants: { include: { user: { select: { name: true } } } },
        attachments: { where: { deletedAt: null }, select: { id: true, fileName: true, fileSizeBytes: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.action.findMany({
      where: {
        facilityId: { in: ids },
        dueDate: { gte: start, lt: end },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { facility: true, owner: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.facility.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...activities.map((row) => ({
      id: row.id,
      kind: ["SITE_VISIT", "DEMONSTRATION", "TRAINING"].includes(row.type)
        ? ("visit" as const)
        : ("activity" as const),
      title:
        row.type === "SITE_VISIT"
          ? `Site visit · ${row.facility.name}`
          : row.type === "DEMONSTRATION"
            ? `Demo / meeting · ${row.facility.name}`
            : row.type === "TRAINING"
              ? `Training · ${row.facility.name}`
              : row.facility.name,
      facility: row.facility.name,
      facilityId: row.facilityId,
      at: (row.startTime || row.date).toISOString(),
      end: row.endTime?.toISOString() || null,
      href: row.reports[0] ? `/reports/${row.reports[0].id}` : `/facilities/${row.facilityId}`,
      by: row.responsibleUser.name,
      activityType: row.type,
      reportId: row.reports[0]?.id || null,
      members: row.participants.map((participant) => participant.user.name),
      attachments: row.attachments,
    })),
    ...actions.map((row) => ({
      id: row.id,
      kind: "action" as const,
      title: row.title,
      facility: row.facility.name,
      facilityId: row.facilityId,
      at: row.dueDate.toISOString(),
      end: null,
      href: `/actions?facilityId=${row.facilityId}`,
      by: row.owner.name,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Jump to any past or future day, then log a site visit, demo/meeting, or training. A report is optional and can be attached later."
        illustration="/brand/illustrations/page-calendar.png"
        actions={<ScopeFilter />}
      />
      <CalendarBoard
        year={year}
        month={monthIndex}
        view={view === "week" ? "week" : "month"}
        focusDay={focusDay}
        events={events}
        facilities={facilities}
        users={users}
        currentUserId={user.id}
        canWriteReport={hasPermission(user.role, "reports.manage")}
      />
    </div>
  );
}
