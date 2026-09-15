/** Person profile: role, assignments, recent work. */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { formatDate, formatRole } from "@/lib/utils";
import { Building2, Siren, ClipboardCheck, Star } from "lucide-react";
import { OPEN_ACTION_STATUSES, OPEN_INCIDENT_STATUS_QUERY } from "@/lib/incident-status";

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
        status: { in: [...OPEN_INCIDENT_STATUS_QUERY] },
      },
    }),
    prisma.action.findMany({
      where: {
        ownerId: userId,
        status: { in: [...OPEN_ACTION_STATUSES] },
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
  const activeAssignments = assignments.filter((row) => row.isActive);

  return (
    <div>
      <PageHeader
        title={person.name}
        description={`${formatRole(person.role)} · ${person.isActive ? "Active" : "Deactivated"}`}
        illustration="/brand/illustrations/page-profile.png"
      />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Assigned facilities"
          value={activeAssignments.length}
          href={`/facilities?userId=${userId}`}
          icon={Building2}
        />
        <MetricCard
          label="Lead facilities"
          value={activeAssignments.filter((row) => row.isLead).length}
          href={`/facilities?userId=${userId}`}
          icon={Star}
        />
        <MetricCard
          label="Open incidents"
          value={incidents.length}
          href={`/incidents?assigneeId=${userId}&status=open`}
          icon={Siren}
        />
        <MetricCard
          label="Overdue actions"
          value={overdue.length}
          href={`/actions?ownerId=${userId}&overdue=1`}
          icon={ClipboardCheck}
        />
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
                  {" · "}
                </span>
                <Link className="text-brand" href={`/incidents?facilityId=${row.facilityId}&assigneeId=${userId}`}>
                  incidents
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Recent activities</h2>
          <ul className="space-y-2 text-sm">
            {activities.map((row) => (
              <li key={row.id}>
                {formatDate(row.date)} ·{" "}
                <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                  {row.facility.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
