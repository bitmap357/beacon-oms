/** Incident detail, history, related actions. Status machine: /api/incidents/[id] */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertFacilityAccess, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page";
import { IncidentStatusPill, PriorityPill, ActionStatusPill } from "@/components/ui/status-pill";
import { SimpleForm } from "@/components/forms";
import { ActionForm } from "@/components/action-form";
import { formatDate, formatDateTime, incidentLabel, labelize } from "@/lib/utils";
import { DeleteButton } from "@/components/record-actions";
import { IncidentCommentForm } from "@/components/incident-comment-form";
import { AttachmentPanel } from "@/components/attachment-panel";
import { incidentStatusOptions, canonicalIncidentStatus, labelIncidentStatus } from "@/lib/incident-status";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      facility: true,
      branch: true,
      reporter: true,
      assignee: true,
      history: { orderBy: { changedAt: "asc" } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      actions: { include: { owner: true }, orderBy: { dueDate: "asc" } },
      qaRecords: true,
      attachments: { where: { deletedAt: null } },
    },
  });
  if (!incident) notFound();
  await assertFacilityAccess(user, incident.facilityId);
  const canManage = hasPermission(user.role, "incidents.manage");
  const canAssign = hasPermission(user.role, "incidents.assign");
  const canUpdate =
    !incident.archivedAt &&
    (hasPermission(user.role, "incidents.create") || canManage);
  const canClose = hasPermission(user.role, "qa.manage");
  const canAddAction = !incident.archivedAt && hasPermission(user.role, "actions.manage");
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const updateFields = [
    {
      name: "status",
      label: "Status",
      options: incidentStatusOptions(
        canClose,
        canonicalIncidentStatus(incident.status),
      ).map((value) => ({
        value,
        label: labelIncidentStatus(value),
      })),
      defaultValue: String(canonicalIncidentStatus(incident.status)),
    },
    {
      name: "priority",
      label: "Priority",
      options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({
        value,
        label: labelize(value),
      })),
      defaultValue: incident.priority,
    },
    {
      name: "description",
      label: "Incident",
      textarea: true,
      required: true,
      defaultValue: incident.description,
    },
    {
      name: "reportedAt",
      label: "Date reported",
      type: "date",
      required: true,
      defaultValue: incident.reportedAt.toISOString().slice(0, 10),
    },
    ...(canAssign
      ? [
          {
            name: "assigneeId",
            label: "Assignee (optional)",
            options: [
              { value: "", label: "Unassigned" },
              ...users.map((row) => ({ value: row.id, label: row.name })),
            ],
            defaultValue: incident.assigneeId || "",
          },
        ]
      : []),
    {
      name: "resolutionInfo",
      label: "Resolution (optional)",
      textarea: true,
      defaultValue: incident.resolutionInfo || "",
    },
    {
      name: "updatedAt",
      label: "Current timestamp",
      type: "hidden",
      defaultValue: incident.updatedAt.toISOString(),
    },
  ];

  return (
    <div>
      <PageHeader
        title={incidentLabel(incident)}
        description={`${incident.facility.name}${incident.branch ? ` · ${incident.branch.name}` : ""}${incident.archivedAt ? " · Archived" : ""}`}
        illustration="/brand/illustrations/page-incidents.png"
        actions={
          <div className="flex items-center gap-2">
            <PriorityPill priority={incident.priority} />
            {canManage && !incident.archivedAt ? (
              <DeleteButton
                path={`/api/incidents/${incident.id}`}
                label="Archive"
                confirmTitle="Archive this incident?"
                confirmDescription="The incident is hidden from default lists. Comments and history are kept."
                successToast="Archived"
                redirectTo="/incidents"
              />
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card tint="navy" className="p-5 xl:col-span-2">
          <p className="text-sm whitespace-pre-wrap">{incident.description || "Incident"}</p>
          <p className="mt-4 text-[13px] text-slate">
            <Link className="text-brand" href={`/facilities/${incident.facilityId}`}>
              {incident.facility.name}
            </Link>
            {incident.branch ? ` · ${incident.branch.name}` : ""} · reported by {incident.reporter.name} · {formatDate(incident.reportedAt)} ·{" "}
            <IncidentStatusPill status={incident.status} />
            {!canAssign && incident.assignee ? ` · assignee ${incident.assignee.name}` : ""}
          </p>
          {incident.resolutionInfo ? (
            <p className="mt-3 text-sm">Resolution: {incident.resolutionInfo}</p>
          ) : null}
          <div className="mt-6">
            <AttachmentPanel
              relatedType="INCIDENT"
              relatedId={incident.id}
              attachments={incident.attachments}
            />
          </div>
          <h2 className="font-heading mt-6 mb-2 text-[18px]">Required actions</h2>
          {incident.actions.length === 0 ? (
            <p className="mb-3 text-sm text-slate">This incident has no follow-up actions yet.</p>
          ) : (
            <Table className="mb-4">
              <THead>
                <TR>
                  <TH>Action</TH>
                  <TH>Owner</TH>
                  <TH>Due</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {incident.actions.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link className="text-brand" href={`/actions?incidentId=${incident.id}`}>
                        {row.title}
                      </Link>
                    </TD>
                    <TD>{row.owner.name}</TD>
                    <TD className="font-mono text-[12px]">{formatDate(row.dueDate)}</TD>
                    <TD>
                      <ActionStatusPill status={row.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          {canAddAction ? (
            <ActionForm
              facilities={[{ id: incident.facilityId, name: incident.facility.name }]}
              incidents={[incident]}
              users={users}
              defaultFacilityId={incident.facilityId}
              defaultIncidentId={incident.id}
              lockFacility
              lockIncident
            />
          ) : (
            <p className="text-sm text-slate">
              {incident.archivedAt
                ? "This incident is archived."
                : "You can view actions. Adding one needs action permission."}
            </p>
          )}
          <h2 className="font-heading mt-6 mb-2 text-[18px]">Comments</h2>
          {incident.comments.length === 0 ? (
            <p className="mb-3 text-sm text-slate">No comments yet. Add a follow-up or note if you are waiting on a response.</p>
          ) : (
            <ul className="mb-4 space-y-3 text-sm">
              {incident.comments.map((row) => (
                <li key={row.id} className="rounded-[12px] border border-hairline p-3">
                  <p className="text-[12px] text-slate">
                    {row.author.name} · {formatDateTime(row.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
                </li>
              ))}
            </ul>
          )}
          {!incident.archivedAt ? <IncidentCommentForm incidentId={incident.id} /> : null}
          <h2 className="font-heading mt-6 mb-2 text-[18px]">History</h2>
          <ol className="space-y-2 text-sm">
            {incident.history.map((row) => (
              <li key={row.id}>
                <span className="font-mono text-[12px] text-slate">
                  {formatDateTime(row.changedAt)}
                </span>{" "}
                {row.fieldChanged}:{" "}
                {row.fieldChanged === "status"
                  ? `${row.oldValue ? labelIncidentStatus(row.oldValue) : "—"} → ${row.newValue ? labelIncidentStatus(row.newValue) : "—"}`
                  : `${row.oldValue || "—"} → ${row.newValue}`}
              </li>
            ))}
          </ol>
        </Card>
        <Card tint="gold" className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Update</h2>
          {canUpdate ? (
            <SimpleForm
              action={`/api/incidents/${id}`}
              method="PATCH"
              submitLabel="Save changes"
              fields={updateFields}
            />
          ) : (
            <p className="text-sm text-slate">
              {incident.archivedAt
                ? "Archived incidents are read-only."
                : "You can add comments. Status changes need a create or manage permission."}
            </p>
          )}
          <p className="mt-4 text-[12px] text-slate">
            Saves require the current updatedAt. Refresh if someone else saved first.
          </p>
          <Link className="mt-3 inline-block text-sm text-brand" href={`/qa?incidentId=${id}`}>
            Record QA
          </Link>
        </Card>
      </div>
    </div>
  );
}
