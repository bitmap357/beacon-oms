/** One facility: assignments, branches, timeline, status override, handover. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertFacilityAccess, hasPermission } from "@/lib/permissions";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { StatusPill, TonePill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm } from "@/components/forms";
import { ActivityForm } from "@/components/activity-form";
import { HandoverSnapshot } from "@/components/handover-snapshot";
import { formatDate, formatDateTime, formatRole, incidentLabel, labelize } from "@/lib/utils";
import { IncidentImportForm } from "@/components/incident-forms";
import { Button } from "@/components/ui/button";
import { DeleteButton, EditDeleteControls } from "@/components/record-actions";
import { OPEN_INCIDENT_STATUSES } from "@/lib/incident-status";
import { Plus } from "lucide-react";

const OPEN = OPEN_INCIDENT_STATUSES;

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  await assertFacilityAccess(user, id);
  const facility = await prisma.facility.findUnique({
    where: { id },
    include: {
      clientOrganization: true,
      region: true,
      branches: { orderBy: { name: "asc" } },
      assignments: {
        include: { user: true },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!facility) notFound();

  const [incidents, actions, activities, handovers, users, visit] = await Promise.all([
    prisma.incident.findMany({
      where: { facilityId: id },
      include: { assignee: true, branch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.action.findMany({
      where: { facilityId: id },
      include: { owner: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.activity.findMany({
      where: { facilityId: id },
      include: {
        responsibleUser: true,
        participants: { include: { user: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.handover.findMany({
      where: { facilityId: id },
      include: { fromUser: true, toUser: true, initiatedBy: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    calculateVisitRecommendation(id),
  ]);

  const openIncidents = incidents.filter((row) => OPEN.includes(row.status as (typeof OPEN)[number]));
  const overdue = actions.filter(
    (row) =>
      row.dueDate < new Date() &&
      ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"].includes(row.status),
  );
  const lead = facility.assignments.find((row) => row.isActive && row.isLead);
  const lastVisit = activities.find((row) => row.type === "SITE_VISIT");

  return (
    <div>
      <PageHeader
        title={facility.name}
        description={`${facility.clientOrganization.name}${facility.branches.length ? ` · ${facility.branches.length} branch${facility.branches.length === 1 ? "" : "es"}` : ""}`}
        illustration="/brand/illustrations/page-facilities.png"
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={facility.status} />
            {hasPermission(user.role, "facilities.manage") ? (
              <DeleteButton path={`/api/facilities/${id}`} redirectTo="/facilities" />
            ) : null}
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/incidents/new?facilityId=${id}`}>
            <Plus className="h-4 w-4" />
            Create incident
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/actions?facilityId=${id}`}>Create action</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/reports?facilityId=${id}`}>View reports</Link>
        </Button>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Lead PM/QA" value={lead?.user.name || "Unassigned"} />
        <MetricCard label="Open incidents" value={openIncidents.length} href={`/incidents?facilityId=${id}&status=open`} />
        <MetricCard label="Overdue actions" value={overdue.length} href={`/actions?facilityId=${id}&overdue=1`} />
        <MetricCard
          label="Visit"
          value={labelize(visit.recommendation)}
          href="/calendar"
        />
      </div>
      <Card className="mb-6 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Bulk upload incidents</h2>
        <IncidentImportForm facilityId={id} />
      </Card>
      {visit.reason ? (
        <p className="mb-4 text-[13px] text-slate">{visit.reason}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="font-heading mb-3 text-[18px]">Overview</h2>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-slate">Organization</dt>
              <dd>
                <Link className="text-brand" href="/admin/organizations">
                  {facility.clientOrganization.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-slate">Location</dt>
              <dd>{facility.location || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate">Contact</dt>
              <dd>{facility.contactInfo || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate">Last site visit</dt>
              <dd>{formatDate(lastVisit?.date)}</dd>
            </div>
            <div>
              <dt className="text-slate">Created</dt>
              <dd className="font-mono text-[12px]">{formatDate(facility.createdAt)}</dd>
            </div>
          </dl>
          <h3 className="font-heading mt-5 mb-2 text-[18px]">Current team</h3>
          <ul className="space-y-1 text-sm">
            {facility.assignments
              .filter((row) => row.isActive)
              .map((row) => (
                <li key={row.id}>
                  <Link className="text-brand" href={`/profile/${row.userId}`}>
                    {row.user.name}
                  </Link>{" "}
                  <span className="text-slate">
                    {formatRole(row.assignmentType)}
                    {row.isLead ? " · lead" : ""}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Quick actions</h2>
          {hasPermission(user.role, "assignments.manage") ? (
            <SimpleForm
              action={`/api/facilities/${id}/assignments`}
              submitLabel="Assign teammate"
              fields={[
                {
                  name: "userId",
                  label: "Person",
                  required: true,
                  options: users
                .filter((row) => row.role === "PM_QA" || row.role === "DEVELOPER")
                .map((row) => ({
                  value: row.id,
                  label: `${row.name} (${row.role})`,
                })),
                },
                {
                  name: "assignmentType",
                  label: "Assignment type",
                  required: true,
                  options: [
                    { value: "PM_QA", label: "PM/QA" },
                    { value: "DEVELOPER", label: "Developer" },
                  ],
                },
              ]}
            />
          ) : (
            <p className="text-sm text-slate">You can record work from the incident and activity lists.</p>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Branches</h2>
        {facility.branches.length === 0 ? (
          <p className="mb-3 text-sm text-slate">
            This facility has no branches. Incidents apply to the site as a whole unless you add one.
          </p>
        ) : (
          <ul className="mb-3 space-y-3 text-sm">
            {facility.branches.map((branch) => (
              <li key={branch.id} className="rounded-[12px] border border-hairline p-3">
                <div>
                  {branch.name}
                  {branch.location ? <span className="text-slate"> · {branch.location}</span> : null}
                </div>
                {hasPermission(user.role, "facilities.manage") ? (
                  <div className="mt-2">
                    <EditDeleteControls
                      path={`/api/facilities/${id}/branches/${branch.id}`}
                      fields={[
                        { name: "name", label: "Branch name", required: true, defaultValue: branch.name },
                        { name: "location", label: "Location", defaultValue: branch.location || "" },
                      ]}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {hasPermission(user.role, "facilities.manage") ? (
          <SimpleForm
            action={`/api/facilities/${id}/branches`}
            submitLabel="Add branch"
            fields={[
              { name: "name", label: "Branch name", required: true },
              { name: "location", label: "Location" },
            ]}
          />
        ) : null}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Record activity</h2>
        <ActivityForm
          facilityId={id}
          facilityName={facility.name}
          users={users.map((row) => ({ id: row.id, name: row.name }))}
          currentUserId={user.id}
        />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Open incidents</h2>
          <Table>
            <THead>
              <TR>
                <TH>Incident</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {openIncidents.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <Link className="text-brand" href={`/incidents/${row.id}`}>
                      {incidentLabel(row)}
                    </Link>
                    {row.branch ? (
                      <span className="block text-[12px] text-slate">{row.branch.name}</span>
                    ) : null}
                  </TD>
                  <TD>
                    <TonePill tone={row.priority === "CRITICAL" ? "danger" : "warn"}>
                      {labelize(row.priority)}
                    </TonePill>
                  </TD>
                  <TD>{labelize(row.status)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Open actions</h2>
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Due</TH>
                <TH>Owner</TH>
              </TR>
            </THead>
            <TBody>
              {actions
                .filter((row) => row.status !== "COMPLETED" && row.status !== "CANCELLED")
                .map((row) => (
                  <TR key={row.id}>
                    <TD>{row.title}</TD>
                    <TD className="font-mono text-[12px]">{formatDate(row.dueDate)}</TD>
                    <TD>{row.owner.name}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Timeline</h2>
        <ol className="space-y-3">
          {activities.map((row) => (
            <li key={row.id} className="border-l border-hairline pl-3">
              <p className="text-[12px] font-mono text-slate">{formatDateTime(row.date)}</p>
              <p className="text-sm">
                {labelize(row.type)} · {row.responsibleUser.name}
                {row.participants.length
                  ? ` · with ${row.participants.map((participant) => participant.user.name).join(", ")}`
                  : ""}
              </p>
              <p className="text-[13px] text-slate">{row.description}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Assignment history</h2>
          <Table>
            <THead>
              <TR>
                <TH>Member</TH>
                <TH>Assignment</TH>
                <TH>Status</TH>
                <TH>Start</TH>
              </TR>
            </THead>
            <TBody>
              {facility.assignments.map((row) => (
                <TR key={row.id}>
                  <TD>{row.user.name}</TD>
                  <TD>
                    {formatRole(row.assignmentType)}
                    {row.isLead ? " · lead" : ""}
                  </TD>
                  <TD>{row.isActive ? "Active" : "Removed"}</TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.startDate)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Handovers</h2>
          {hasPermission(user.role, "handovers.manage") ? (
            <SimpleForm
              action={`/api/facilities/${id}/handovers`}
              submitLabel="Start handover"
              fields={[
                {
                  name: "fromUserId",
                  label: "From",
                  options: [{ value: "", label: "—" }, ...users.map((row) => ({ value: row.id, label: row.name }))],
                },
                {
                  name: "toUserId",
                  label: "To",
                  options: [{ value: "", label: "—" }, ...users.map((row) => ({ value: row.id, label: row.name }))],
                },
                { name: "notes", label: "Notes", textarea: true },
              ]}
            />
          ) : null}
          <ul className="mt-4 space-y-2 text-sm">
            {handovers.map((row) => (
              <li key={row.id} className="space-y-1">
                <p>
                  {formatDate(row.createdAt)} · {row.fromUser?.name || "—"} → {row.toUser?.name || "—"}
                </p>
                <HandoverSnapshot value={row.summarySnapshot} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {hasPermission(user.role, "facilities.statusOverride") ? (
        <Card className="mt-4 p-5">
          <h2 className="font-heading mb-3 text-[18px]">Status override</h2>
          <SimpleForm
            action={`/api/facilities/${id}/status-override`}
            submitLabel="Apply override"
            fields={[
              {
                name: "status",
                label: "Status",
                required: true,
                options: [
                  "HEALTHY",
                  "ATTENTION_REQUIRED",
                  "AT_RISK",
                  "CRITICAL",
                  "INACTIVE",
                ].map((value) => ({ value, label: labelize(value) })),
              },
              { name: "reason", label: "Reason", textarea: true, required: true },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
