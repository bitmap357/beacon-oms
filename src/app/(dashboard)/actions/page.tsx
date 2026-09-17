/** Follow-up actions across facilities. Due dates also appear on the calendar in red. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader, CollapsibleSection } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActionForm } from "@/components/action-form";
import { formatDate, incidentLabel, labelize } from "@/lib/utils";
import { ActionStatusPill } from "@/components/ui/status-pill";
import { ScopeFilter } from "@/components/scope-filter";
import { EditDeleteControls } from "@/components/record-actions";
import { IllustratedEmpty } from "@/components/empty-state";
import { ListFilters } from "@/components/list-filters";
import { OPEN_ACTION_STATUSES, dateRange } from "@/lib/incident-status";

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
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const ids = await getScopedFacilityIds(user, query.scope);
  const scopedIds = query.facilityId && ids.includes(query.facilityId) ? [query.facilityId] : ids;
  const now = new Date();
  const dueRange = dateRange(query.from, query.to);
  const [actions, facilities, users, incidents] = await Promise.all([
    prisma.action.findMany({
      where: {
        facilityId: { in: scopedIds },
        ...(query.incidentId ? { incidentId: query.incidentId } : {}),
        ...(query.mine === "1" ? { ownerId: user.id } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(dueRange ? { dueDate: dueRange } : {}),
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
      where: { facilityId: { in: ids } },
      select: { id: true, facilityId: true, title: true, description: true, createdAt: true, reportedAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const canManage = hasPermission(user.role, "actions.manage");

  return (
    <div>
      <PageHeader
        title="Actions"
        description="Follow-up work required by incidents, with owners and due dates."
        illustration="/brand/illustrations/page-actions.png"
        actions={<ScopeFilter includeMine />}
      />
      <ListFilters
        exportPath="/api/export/actions"
        fields={[
          {
            name: "facilityId",
            label: "Facility",
            kind: "select",
            emptyLabel: "All facilities",
            options: facilities.map((row) => ({ value: row.id, label: row.name })),
          },
          {
            name: "ownerId",
            label: "Owner",
            kind: "select",
            emptyLabel: "Anyone",
            options: users.map((row) => ({ value: row.id, label: row.name })),
          },
          {
            name: "status",
            label: "Status",
            kind: "select",
            options: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"].map((value) => ({
              value,
              label: labelize(value),
            })),
          },
          { name: "from", label: "Due from", kind: "date" },
          { name: "to", label: "Due to", kind: "date" },
          { name: "overdue", label: "Overdue only", kind: "checkbox" },
        ]}
      />
      {canManage ? (
        <CollapsibleSection title="Create action">
          <ActionForm
            facilities={facilities}
            incidents={incidents}
            users={users}
            defaultFacilityId={query.facilityId}
            defaultIncidentId={query.incidentId}
          />
        </CollapsibleSection>
      ) : null}
      {actions.length === 0 ? (
        <IllustratedEmpty
          title="No actions in this view. Create one above, or switch the filter to All."
          image="/brand/illustrations/page-actions.png"
        />
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
                    <TD>
                      <Link
                        className="text-brand"
                        href={
                          row.incidentId
                            ? `/incidents/${row.incidentId}`
                            : `/facilities/${row.facilityId}`
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
                    <TD>
                      <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                        {row.facility.name}
                      </Link>
                    </TD>
                    <TD>{row.owner.name}</TD>
                    <TD className="font-mono text-[12px]">{formatDate(row.dueDate)}</TD>
                    <TD>
                      <ActionStatusPill status={row.status} overdue={overdue} />
                    </TD>
                    <TD className="whitespace-nowrap">
                      {canManage ? (
                        <EditDeleteControls
                          compact
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
                              type: "hidden",
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
