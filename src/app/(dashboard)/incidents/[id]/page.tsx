/** Incident detail, history, related actions. Status machine: /api/incidents/[id] */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertFacilityAccess } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { TonePill } from "@/components/ui/status-pill";
import { SimpleForm } from "@/components/forms";
import { formatDate, formatDateTime, labelize } from "@/lib/utils";

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
      actions: { include: { owner: true } },
      qaRecords: true,
    },
  });
  if (!incident) notFound();
  await assertFacilityAccess(user, incident.facilityId);
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title={incident.title}
        description={`${incident.facility.name}${incident.branch ? ` · ${incident.branch.name}` : ""}`}
        actions={
          <TonePill tone={incident.priority === "CRITICAL" ? "danger" : "warn"}>
            {labelize(incident.priority)}
          </TonePill>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
          <p className="mt-4 text-[13px] text-slate">
            <Link className="text-brand" href={`/facilities/${incident.facilityId}`}>
              {incident.facility.name}
            </Link>
            {incident.branch ? ` · ${incident.branch.name}` : ""} · reported by {incident.reporter.name} · {formatDateTime(incident.createdAt)} · status {labelize(incident.status)}
          </p>
          {incident.resolutionInfo ? (
            <p className="mt-3 text-sm">Resolution: {incident.resolutionInfo}</p>
          ) : null}
          <h2 className="font-heading mt-6 mb-2 text-[18px]">Required actions</h2>
          {incident.actions.length === 0 ? (
            <p className="mb-3 text-sm text-slate">This incident has no follow-up actions yet.</p>
          ) : (
            <ul className="mb-4 space-y-2 text-sm">
              {incident.actions.map((row) => (
                <li key={row.id}>
                  {row.title} · {row.owner.name} · due {formatDate(row.dueDate)} · {labelize(row.status)}
                </li>
              ))}
            </ul>
          )}
          <SimpleForm
            action="/api/actions"
            submitLabel="Add action"
            fields={[
              {
                name: "facilityId",
                label: "Facility",
                options: [{ value: incident.facilityId, label: incident.facility.name }],
              },
              {
                name: "incidentId",
                label: "Incident",
                options: [{ value: incident.id, label: incident.title }],
              },
              { name: "title", label: "Action title", required: true },
              {
                name: "ownerId",
                label: "Owner",
                required: true,
                options: users.map((row) => ({ value: row.id, label: row.name })),
              },
              {
                name: "priority",
                label: "Priority",
                required: true,
                options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({
                  value,
                  label: labelize(value),
                })),
              },
              { name: "dueDate", label: "Due date", type: "date", required: true },
              { name: "description", label: "Description", textarea: true },
            ]}
          />
          <h2 className="font-heading mt-6 mb-2 text-[18px]">History</h2>
          <ol className="space-y-2 text-sm">
            {incident.history.map((row) => (
              <li key={row.id}>
                <span className="font-mono text-[12px] text-slate">
                  {formatDateTime(row.changedAt)}
                </span>{" "}
                {row.fieldChanged}: {row.oldValue || "—"} → {row.newValue}
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Update</h2>
          <SimpleForm
            action={`/api/incidents/${id}`}
            method="PATCH"
            submitLabel="Save changes"
            fields={[
              {
                name: "status",
                label: "Status",
                options: [
                  "NEW",
                  "ASSIGNED",
                  "IN_PROGRESS",
                  "AWAITING_QA",
                  "REOPENED",
                  "RESOLVED",
                  "CLOSED",
                ].map((value) => ({ value, label: labelize(value) })),
              },
              {
                name: "assigneeId",
                label: "Assignee",
                options: users.map((row) => ({ value: row.id, label: row.name })),
              },
              { name: "resolutionInfo", label: "Resolution", textarea: true },
              { name: "updatedAt", label: "Current timestamp", options: [{ value: incident.updatedAt.toISOString(), label: "Use latest" }] },
            ]}
          />
          <p className="mt-4 text-[12px] text-slate">
            High-risk closes use optimistic locking. Refresh if someone else saved first.
          </p>
          <Link className="mt-3 inline-block text-sm text-brand" href={`/qa?incidentId=${id}`}>
            Record QA
          </Link>
        </Card>
      </div>
    </div>
  );
}
