/**
 * Loads activities + open actions for the month (padded for week view) and hands them to CalendarBoard.
 * Query: ?month=YYYY-MM&view=month|week&day=YYYY-MM-DD
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { CalendarBoard, type CalendarEvent } from "@/components/calendar-board";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; day?: string }>;
}) {
  const user = await requireUser();
  const { month, view, day } = await searchParams;
  const ids = await getAccessibleFacilityIds(user);
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
      include: { facility: true, responsibleUser: true },
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
      kind: row.type === "SITE_VISIT" ? ("visit" as const) : ("activity" as const),
      title: row.type === "SITE_VISIT" ? `Visit · ${row.facility.name}` : row.facility.name,
      facility: row.facility.name,
      facilityId: row.facilityId,
      at: (row.startTime || row.date).toISOString(),
      end: row.endTime?.toISOString() || null,
      href: `/facilities/${row.facilityId}`,
      by: row.responsibleUser.name,
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
        description="Site visits are logged as timed activities. Open a day to record who went, when, and what was covered. Gold is a visit, blue is other activity, red is an action due date."
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
      />
    </div>
  );
}
