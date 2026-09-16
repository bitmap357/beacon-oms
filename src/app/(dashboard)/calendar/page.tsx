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
import { ListFilters } from "@/components/list-filters";
import { isVisitType, labelActivityType } from "@/lib/activity-types";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; day?: string; scope?: string; facilityId?: string; userId?: string }>;
}) {
  const user = await requireUser();
  const { month, view, day, scope, facilityId, userId } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const scopedIds = facilityId && ids.includes(facilityId) ? [facilityId] : ids;
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
      where: {
        facilityId: { in: scopedIds },
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
      include: {
        facility: true,
        responsibleUser: true,
        reports: { select: { id: true }, take: 1 },
        participants: { include: { user: { select: { id: true, name: true } } } },
        attachments: { where: { deletedAt: null }, select: { id: true, fileName: true, fileSizeBytes: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.action.findMany({
      where: {
        facilityId: { in: scopedIds },
        dueDate: { gte: start, lt: end },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        ...(userId ? { ownerId: userId } : {}),
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
      kind: isVisitType(row.type) ? ("visit" as const) : ("activity" as const),
      title: `${labelActivityType(row.type)} · ${row.facility.name}`,
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
      description: row.description,
      findings: row.findings,
      responsibleUserId: row.responsibleUserId,
      participantIds: row.participants.map((participant) => participant.user.id),
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
        description="Jump to any past or future day, then log a visit. A report file is optional and can be attached later."
        illustration="/brand/illustrations/page-calendar.png"
        actions={<ScopeFilter />}
      />
      <ListFilters
        exportPath="/api/export/calendar"
        fields={[
          {
            name: "facilityId",
            label: "Facility",
            kind: "select",
            emptyLabel: "All facilities",
            options: facilities.map((row) => ({ value: row.id, label: row.name })),
          },
          {
            name: "userId",
            label: "Person",
            kind: "select",
            emptyLabel: "Anyone",
            options: users.map((row) => ({ value: row.id, label: row.name })),
          },
        ]}
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
