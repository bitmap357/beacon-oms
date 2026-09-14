/** Person profile: role, assignments, recent work. */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { formatDate, formatRole } from "@/lib/utils";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireUser();
  const { userId } = await params;
  const person = await prisma.user.findUnique({ where: { id: userId } });
  if (!person) notFound();

  const [assignments, incidents, actions, activities] = await Promise.all([
    prisma.facilityAssignment.findMany({
      where: { userId },
      include: { facility: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.incident.findMany({
      where: {
        assigneeId: userId,
        status: { in: ["NEW", "ASSIGNED", "IN_PROGRESS", "AWAITING_QA", "REOPENED"] },
      },
    }),
    prisma.action.findMany({
      where: {
        ownerId: userId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
      },
    }),
    prisma.activity.findMany({
      where: { responsibleUserId: userId },
      include: { facility: true },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);
  const overdue = actions.filter((row) => row.dueDate < new Date());

  return (
    <div>
      <PageHeader
        title={person.name}
        description={`${formatRole(person.role)} · ${person.isActive ? "Active" : "Deactivated"}`}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assigned facilities" value={assignments.filter((row) => row.isActive).length} />
        <MetricCard label="Lead facilities" value={assignments.filter((row) => row.isActive && row.isLead).length} />
        <MetricCard label="Open incidents" value={incidents.length} />
        <MetricCard label="Overdue actions" value={overdue.length} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Facilities</h2>
          <ul className="space-y-2 text-sm">
            {assignments.map((row) => (
              <li key={row.id}>
                <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                  {row.facility.name}
                </Link>
                <span className="text-slate">
                  {" "}
                  · {row.isLead ? "Lead" : "Member"} · {row.isActive ? "Active" : "Past"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Recent activities</h2>
          <ul className="space-y-2 text-sm">
            {activities.map((row) => (
              <li key={row.id}>
                {formatDate(row.date)} · {row.facility.name}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
