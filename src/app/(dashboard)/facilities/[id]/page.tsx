/** One facility: assignments, branches, timeline, status override, handover. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertFacilityAccess, hasPermission } from "@/lib/permissions";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { FACILITY_HEALTH_CRITERIA } from "@/lib/rules/facilityHealth";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { StatusPill, IncidentStatusPill, PriorityPill, ActionStatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm } from "@/components/forms";
import { ActivityForm, EditVisitButton } from "@/components/activity-form";
import { HandoverSnapshot } from "@/components/handover-snapshot";
import { formatDate, formatDateTime, formatContact, formatRole, incidentLabel, labelize } from "@/lib/utils";
import { IncidentImportForm } from "@/components/incident-forms";
import { Button } from "@/components/ui/button";
import { DeleteButton, EditDeleteControls } from "@/components/record-actions";
import { AssignmentActions } from "@/components/assignment-actions";
import { isClosedIncidentStatus, isOpenActionStatus, isOpenIncidentStatus, labelIncidentStatus } from "@/lib/incident-status";
import { isVisitType, labelActivityType } from "@/lib/activity-types";
import { Plus } from "lucide-react";
import { FacilityLogoForm, FacilityLogoMark } from "@/components/facility-logo";

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
      clientOrganization: { include: { regions: { orderBy: { name: "asc" } } } },
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
      include: { owner: true, incident: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.activity.findMany({
      where: { facilityId: id },
      include: {
        responsibleUser: true,
        participants: { include: { user: { select: { id: true, name: true } } } },
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

  const openIncidents = incidents.filter((row) => isOpenIncidentStatus(row.status));
  const closedIncidents = incidents.filter((row) => isClosedIncidentStatus(row.status));
  const overdue = actions.filter(
    (row) => row.dueDate < new Date() && isOpenActionStatus(row.status),
  );
  const activeTeam = facility.assignments.filter((row) => row.isActive);
  const leadPm = activeTeam.find((row) => row.assignmentType === "PM_QA" && row.isLead);
  const leadDev = activeTeam.find((row) => row.assignmentType === "DEVELOPER" && row.isLead);
  const hasPm = activeTeam.some((row) => row.assignmentType === "PM_QA");
  const hasDev = activeTeam.some((row) => row.assignmentType === "DEVELOPER");
  const staffingGaps = [
    !hasPm ? "at least one PM/QA" : null,
    !hasDev ? "at least one developer" : null,
    hasPm && !leadPm ? "a Lead PM/QA" : null,
    hasDev && !leadDev ? "a Lead Developer" : null,
  ].filter((row): row is string => Boolean(row));
  const visits = activities.filter((row) => isVisitType(row.type));
  const otherActivities = activities.filter((row) => !isVisitType(row.type));
  const lastVisit = visits[0];
  const openActions = actions.filter((row) => row.status !== "COMPLETED" && row.status !== "CANCELLED");
  const userOptions = users.map((row) => ({ id: row.id, name: row.name }));
  const canWrite = hasPermission(user.role, "activities.create");

  return (
    <div>
      <PageHeader
        title={facility.name}
        description={`${facility.clientOrganization.name}${facility.region ? ` · ${facility.region.name}` : ""}${facility.branches.length ? ` · ${facility.branches.length} branch${facility.branches.length === 1 ? "" : "es"}` : ""}`}
        illustration="/brand/illustrations/page-facilities.png"
        actions={
          <div className="flex items-center gap-2">
            <FacilityLogoMark
              facilityId={id}
              hasLogo={Boolean(facility.logoS3Key)}
              name={facility.name}
              size={48}
            />
            <StatusPill status={facility.status} />
            {hasPermission(user.role, "facilities.manage") ? (
              <DeleteButton path={`/api/facilities/${id}`} redirectTo="/facilities" />
            ) : null}
          </div>
        }
      />
      <Card className="mb-6 border-gold/40 bg-status-gold-bg/60 p-4">
        <p className="font-heading text-[15px] text-brand-deep">
          Status: {labelize(facility.status)}
          {facility.statusOverride ? " (manual override)" : " (calculated)"}
        </p>
        <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink">
          {FACILITY_HEALTH_CRITERIA.map((row) => (
            <li key={row.status}>
              <span className="font-medium text-brand">{labelize(row.status)}:</span> {row.rule}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-slate">
          Staffing gaps (Lead PM/QA / Lead Developer) are shown separately and do not change this
          health score by themselves.
        </p>
      </Card>
      {staffingGaps.length ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-gold bg-status-gold-bg px-4 py-3 text-sm text-ink"
        >
          <p className="font-medium">Staffing needed</p>
          <p className="mt-1 text-[13px] leading-relaxed">
            This facility still needs {staffingGaps.join(" and ")}. Every facility should have at least
            one PM/QA, one developer, a Lead PM/QA, and a Lead Developer.
          </p>
        </div>
      ) : null}
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
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Lead PM/QA" value={leadPm?.user.name || "Unassigned"} />
        <MetricCard label="Lead Developer" value={leadDev?.user.name || "Unassigned"} />
        <MetricCard label="Open incidents" value={openIncidents.length} href={`/incidents?facilityId=${id}&status=open`} />
        <MetricCard label="Overdue actions" value={overdue.length} href={`/actions?facilityId=${id}&overdue=1`} />
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
              <dt className="text-slate">Region</dt>
              <dd>{facility.region?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate">Location</dt>
              <dd>{facility.location || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate">Contact</dt>
              <dd>
                {formatContact(
                  facility.contactPerson || facility.contactInfo,
                  facility.contactPhone,
                  facility.contactEmail,
                ) || "No contact listed"}
              </dd>
            </div>
            <div>
              <dt className="text-slate">Last visit</dt>
              <dd>{lastVisit ? formatDateTime(lastVisit.startTime || lastVisit.date) : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate">Created</dt>
              <dd className="font-mono text-[12px]">{formatDate(facility.createdAt)}</dd>
            </div>
          </dl>
          {hasPermission(user.role, "facilities.manage") ? (
            <div className="mt-4 space-y-4">
              <FacilityLogoForm facilityId={id} hasLogo={Boolean(facility.logoS3Key)} />
              <EditDeleteControls
                path={`/api/facilities/${id}`}
                canDelete={false}
                title="Edit name and location"
                fields={[
                  { name: "name", label: "Facility name", required: true, defaultValue: facility.name },
                  {
                    name: "regionId",
                    label: "Region",
                    defaultValue: facility.regionId || "",
                    options: [
                      { value: "", label: "No region" },
                      ...facility.clientOrganization.regions.map((row) => ({
                        value: row.id,
                        label: row.name,
                      })),
                    ],
                  },
                  { name: "location", label: "Location", defaultValue: facility.location || "" },
                  { name: "contactPerson", label: "Contact person", defaultValue: facility.contactPerson || "" },
                  { name: "contactPhone", label: "Contact phone", defaultValue: facility.contactPhone || "" },
                  { name: "contactEmail", label: "Contact email", defaultValue: facility.contactEmail || "" },
                  {
                    name: "updatedAt",
                    label: "Current timestamp",
                    type: "hidden",
                    defaultValue: facility.updatedAt.toISOString(),
                  },
                ]}
              />
            </div>
          ) : null}
          <h3 className="font-heading mt-5 mb-2 text-[18px]">Current team</h3>
          {activeTeam.length === 0 ? (
            <p className="text-sm text-slate">No teammates assigned yet.</p>
          ) : null}
          <ul className="space-y-1 text-sm">
            {activeTeam.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                  <Link className="text-brand" href={`/profile/${row.userId}`}>
                    {row.user.name}
                  </Link>{" "}
                  <span className="text-slate">
                    {formatRole(row.assignmentType)}
                    {row.isLead
                      ? row.assignmentType === "DEVELOPER"
                        ? " · Lead Developer"
                        : " · Lead PM/QA"
                      : ""}
                  </span>
                  </span>
                  {hasPermission(user.role, "assignments.manage") ? (
                    <AssignmentActions
                      assignmentId={row.id}
                      isLead={row.isLead}
                      updatedAt={row.updatedAt.toISOString()}
                    />
                  ) : null}
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
                  label: `${row.name} (${row.role === "PM_QA" ? "PM/QA" : "Developer"})`,
                })),
                },
                {
                  name: "isLead",
                  label: "Role on this facility",
                  options: [
                    { value: "false", label: "Team member" },
                    { value: "true", label: "Lead" },
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
                  {formatContact(branch.contactPerson, branch.contactPhone, branch.contactEmail) ? (
                    <span className="block text-[12px] text-slate">
                      Contact: {formatContact(branch.contactPerson, branch.contactPhone, branch.contactEmail)}
                    </span>
                  ) : (
                    <span className="block text-[12px] text-slate">No contact listed</span>
                  )}
                </div>
                {hasPermission(user.role, "facilities.manage") ? (
                  <div className="mt-2">
                    <EditDeleteControls
                      path={`/api/facilities/${id}/branches/${branch.id}`}
                      title="Edit branch"
                      fields={[
                        { name: "name", label: "Branch name", required: true, defaultValue: branch.name },
                        { name: "location", label: "Location", defaultValue: branch.location || "" },
                        { name: "contactPerson", label: "Contact person", defaultValue: branch.contactPerson || "" },
                        { name: "contactPhone", label: "Contact phone", defaultValue: branch.contactPhone || "" },
                        { name: "contactEmail", label: "Contact email", defaultValue: branch.contactEmail || "" },
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
              { name: "contactPerson", label: "Contact person" },
              { name: "contactPhone", label: "Contact phone" },
              { name: "contactEmail", label: "Contact email" },
            ]}
          />
        ) : null}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Record activity</h2>
        <ActivityForm
          facilityId={id}
          facilityName={facility.name}
          users={userOptions}
          currentUserId={user.id}
          canWriteReport={hasPermission(user.role, "reports.manage")}
        />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card tint="navy" className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Open incidents</h2>
          {openIncidents.length === 0 ? (
            <p className="text-sm text-slate">No open incidents.</p>
          ) : (
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
                    <PriorityPill priority={row.priority} />
                  </TD>
                  <TD>
                    <IncidentStatusPill status={row.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          )}
        </Card>
        <Card tint="navy" className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Closed incidents</h2>
          {closedIncidents.length === 0 ? (
            <p className="text-sm text-slate">No closed incidents yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Incident</TH>
                  <TH>Priority</TH>
                  <TH>Closed</TH>
                </TR>
              </THead>
              <TBody>
                {closedIncidents.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link className="text-brand" href={`/incidents/${row.id}`}>
                        {incidentLabel(row)}
                      </Link>
                    </TD>
                    <TD>
                      <PriorityPill priority={row.priority} />
                    </TD>
                    <TD className="font-mono text-[12px]">
                      {row.closedAt ? formatDate(row.closedAt) : labelIncidentStatus(row.status)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
      <Card tint="gold" className="mt-4 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Open actions</h2>
        {openActions.length === 0 ? (
          <p className="text-sm text-slate">No open actions for this facility.</p>
        ) : (
        <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Incident</TH>
                <TH>Due</TH>
                <TH>Owner</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {openActions.map((row) => {
                const overdue = row.dueDate < new Date() && isOpenActionStatus(row.status);
                return (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        className="text-brand"
                        href={
                          row.incidentId
                            ? `/actions?incidentId=${row.incidentId}`
                            : `/actions?facilityId=${id}`
                        }
                      >
                        {row.title}
                      </Link>
                    </TD>
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
                    <TD>{row.owner.name}</TD>
                    <TD>
                      <ActionStatusPill status={row.status} overdue={overdue} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card tint="gold" className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Visits</h2>
          {visits.length === 0 ? (
            <p className="text-sm text-slate">No visits logged for this facility yet.</p>
          ) : (
            <ol className="space-y-3">
              {visits.map((row) => (
                <li key={row.id} className="border-l-2 border-gold/50 pl-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-mono text-slate">
                        {formatDateTime(row.startTime || row.date)}
                        {row.endTime ? ` – ${formatDateTime(row.endTime)}` : ""}
                      </p>
                      <p className="text-sm">
                        {labelActivityType(row.type)} · {row.responsibleUser.name}
                        {row.participants.length
                          ? ` · with ${row.participants.map((participant) => participant.user.name).join(", ")}`
                          : ""}
                      </p>
                      <p className="text-[13px] text-slate">{row.description}</p>
                    </div>
                    {canWrite ? (
                      <div className="flex items-center gap-1">
                        <EditVisitButton
                          compact
                          facilityId={id}
                          facilityName={facility.name}
                          users={userOptions}
                          currentUserId={user.id}
                          canWriteReport={hasPermission(user.role, "reports.manage")}
                          activity={{
                            id: row.id,
                            type: row.type,
                            date: row.date,
                            startTime: row.startTime,
                            endTime: row.endTime,
                            responsibleUserId: row.responsibleUserId,
                            description: row.description,
                            findings: row.findings,
                            participantIds: row.participants.map((participant) => participant.user.id),
                          }}
                        />
                        <DeleteButton compact path={`/api/activities/${row.id}`} />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card tint="navy" className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Activities</h2>
          {otherActivities.length === 0 ? (
            <p className="text-sm text-slate">No other activities logged for this facility yet.</p>
          ) : (
            <ol className="space-y-3">
              {otherActivities.map((row) => (
                <li key={row.id} className="border-l-2 border-brand/40 pl-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-mono text-slate">
                        {formatDateTime(row.startTime || row.date)}
                        {row.endTime ? ` – ${formatDateTime(row.endTime)}` : ""}
                      </p>
                      <p className="text-sm">
                        {labelActivityType(row.type)} · {row.responsibleUser.name}
                        {row.participants.length
                          ? ` · with ${row.participants.map((participant) => participant.user.name).join(", ")}`
                          : ""}
                      </p>
                      <p className="text-[13px] text-slate">{row.description}</p>
                    </div>
                    {canWrite ? (
                      <div className="flex items-center gap-1">
                        <EditVisitButton
                          compact
                          facilityId={id}
                          facilityName={facility.name}
                          users={userOptions}
                          currentUserId={user.id}
                          canWriteReport={hasPermission(user.role, "reports.manage")}
                          activity={{
                            id: row.id,
                            type: row.type,
                            date: row.date,
                            startTime: row.startTime,
                            endTime: row.endTime,
                            responsibleUserId: row.responsibleUserId,
                            description: row.description,
                            findings: row.findings,
                            participantIds: row.participants.map((participant) => participant.user.id),
                          }}
                        />
                        <DeleteButton compact path={`/api/activities/${row.id}`} />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Assignment history</h2>
          {facility.assignments.length === 0 ? (
            <p className="text-sm text-slate">No assignment history yet.</p>
          ) : (
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
                    {row.isLead
                      ? row.assignmentType === "DEVELOPER"
                        ? " · Lead Developer"
                        : " · Lead PM/QA"
                      : ""}
                  </TD>
                  <TD>{row.isActive ? "Active" : "Removed"}</TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.startDate)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Handovers</h2>
          {hasPermission(user.role, "handovers.manage") ? (
            <div className="mb-4">
              <p className="mb-3 text-sm text-slate">
                Hands Lead PM/QA from{" "}
                <span className="text-ink">{leadPm?.user.name || "No Lead PM/QA assigned"}</span> to
                another PM/QA. The previous lead stays on the team as a member.
              </p>
              {leadPm ? (
                <SimpleForm
                  action={`/api/facilities/${id}/handovers`}
                  submitLabel="Start handover"
                  fields={[
                    {
                      name: "toUserId",
                      label: "To (new Lead PM/QA)",
                      required: true,
                      options: users
                        .filter((row) => row.role === "PM_QA" && row.id !== leadPm.userId)
                        .map((row) => ({ value: row.id, label: row.name })),
                    },
                    { name: "notes", label: "Notes", textarea: true },
                  ]}
                />
              ) : (
                <p className="text-sm text-slate">Assign a Lead PM/QA before starting a handover.</p>
              )}
            </div>
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
              {
                name: "updatedAt",
                label: "Current timestamp",
                type: "hidden",
                defaultValue: facility.updatedAt.toISOString(),
              },
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}
