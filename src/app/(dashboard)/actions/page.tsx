/** Follow-up actions across facilities. Due dates also appear on the calendar in red. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm } from "@/components/forms";
import { formatDate, incidentLabel, labelize } from "@/lib/utils";
import { TonePill } from "@/components/ui/status-pill";
import { ScopeFilter } from "@/components/scope-filter";
import { EditDeleteControls } from "@/components/record-actions";
import { IllustratedEmpty } from "@/components/empty-state";
import { OPEN_ACTION_STATUSES, OPEN_INCIDENT_STATUSES } from "@/lib/incident-status";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    facilityId?: string;
    incidentId?: string;
    scope?: string;
    mine?: string;
    overdue?: string;
    ownerId?: string;
  }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const ids = await getScopedFacilityIds(user, query.scope);
  const scopedIds = query.facilityId && ids.includes(query.facilityId) ? [query.facilityId] : ids;
  const now = new Date();
  const [actions, facilities, users, incidents] = await Promise.all([
    prisma.action.findMany({
      where: {
        facilityId: { in: scopedIds },
        ...(query.incidentId ? { incidentId: query.incidentId } : {}),
        ...(query.mine === "1" ? { ownerId: user.id } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
        ...(query.overdue === "1"
          ? { dueDate: { lt: now }, status: { in: [...OPEN_ACTION_STATUSES] } }
          : {}),
      },
      include: { facility: true, owner: true, incident: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.facility.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.incident.findMany({
      where: {
        facilityId: { in: scopedIds },
        status: { in: [...OPEN_INCIDENT_STATUSES] },
      },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const canManage = hasPermission(user.role, "actions.manage");

  return (
    <div>
      <PageHeader
        title="Actions"
        description="Follow-up work required by incidents, with owners and due dates."
        actions={<ScopeFilter includeMine />}
      />
      <Card className="mb-6 p-5">
        <SimpleForm
          action="/api/actions"
          submitLabel="Create action"
          fields={[
            {
              name: "facilityId",
              label: "Facility",
              required: true,
              options: facilities.map((row) => ({ value: row.id, label: row.name })),
            },
            {
              name: "incidentId",
              label: "Related incident",
              options: [
                { value: query.incidentId || "", label: query.incidentId ? "Selected incident" : "None" },
                ...incidents
                  .filter((row) => row.id !== query.incidentId)
                  .map((row) => ({ value: row.id, label: incidentLabel(row) })),
              ],
            },
            { name: "title", label: "Title", required: true },
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
      </Card>
      {actions.length === 0 ? (
        <IllustratedEmpty title="No actions in this view. Create one above, or switch the filter to All." />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Action</TH>
                <TH>Incident</TH>
                <TH>Facility</TH>
                <TH>Owner</TH>
                <TH>Due</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {actions.map((row) => {
                const overdue =
                  row.dueDate < now && OPEN_ACTION_STATUSES.includes(row.status as (typeof OPEN_ACTION_STATUSES)[number]);
                return (
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
                    <TD>
                      <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                        {row.facility.name}
                      </Link>
                    </TD>
                    <TD>{row.owner.name}</TD>
                    <TD className="font-mono text-[12px]">{formatDate(row.dueDate)}</TD>
                    <TD>
                      <TonePill tone={overdue ? "danger" : row.status === "COMPLETED" ? "ok" : "neutral"}>
                        {overdue ? "Overdue" : labelize(row.status)}
                      </TonePill>
                    </TD>
                    <TD>
                      {canManage ? (
                        <EditDeleteControls
                          path={`/api/actions/${row.id}`}
                          fields={[
                            { name: "title", label: "Title", required: true, defaultValue: row.title },
                            {
                              name: "status",
                              label: "Status",
                              options: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"].map(
                                (value) => ({ value, label: labelize(value) }),
                              ),
                              defaultValue: row.status,
                            },
                            {
                              name: "dueDate",
                              label: "Due date",
                              type: "date",
                              required: true,
                              defaultValue: row.dueDate.toISOString().slice(0, 10),
                            },
                            { name: "notes", label: "Notes", textarea: true, defaultValue: row.notes || "" },
                            {
                              name: "updatedAt",
                              label: "Current timestamp",
                              options: [{ value: row.updatedAt.toISOString(), label: "Use latest" }],
                              defaultValue: row.updatedAt.toISOString(),
                            },
                          ]}
                        />
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
