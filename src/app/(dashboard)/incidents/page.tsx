/** Incident inbox + Excel import. New incident: /incidents/new */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TH, THead, TR } from "@/components/ui/table";
import { IncidentForm, IncidentImportForm } from "@/components/incident-forms";
import { IncidentRow } from "@/components/incident-row";
import { ScopeFilter } from "@/components/scope-filter";
import { IllustratedEmpty } from "@/components/empty-state";
import { OPEN_INCIDENT_STATUSES } from "@/lib/incident-status";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    facilityId?: string;
    scope?: string;
    mine?: string;
    status?: string;
    priority?: string;
    withoutActions?: string;
    assigneeId?: string;
  }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const ids = await getScopedFacilityIds(user, query.scope);
  const scopedIds = query.facilityId && ids.includes(query.facilityId) ? [query.facilityId] : ids;
  const openOnly = query.status === "open";
  const [incidents, facilities, users] = await Promise.all([
    prisma.incident.findMany({
      where: {
        facilityId: { in: scopedIds },
        ...(query.mine === "1" ? { assigneeId: user.id } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(openOnly ? { status: { in: [...OPEN_INCIDENT_STATUSES] } } : {}),
        ...(query.status && !openOnly ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.withoutActions === "1"
          ? { status: { in: [...OPEN_INCIDENT_STATUSES] }, actions: { none: {} } }
          : {}),
      },
      include: {
        facility: true,
        branch: true,
        assignee: true,
        _count: { select: { actions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.facility.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, branches: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
  ]);
  const canManage = hasPermission(user.role, "incidents.manage");
  const canAddAction = hasPermission(user.role, "actions.manage");

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Log incidents by facility, priority, and owner. Update status and add actions here without opening another page."
        actions={<ScopeFilter includeMine />}
      />
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Report one incident</h2>
          <IncidentForm
            facilities={facilities}
            users={users}
            defaultFacilityId={query.facilityId}
          />
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Bulk upload</h2>
          <IncidentImportForm />
        </Card>
      </div>
      {incidents.length === 0 ? (
        <IllustratedEmpty title="No incidents in this view yet. Log one on the left, or switch the filter to All." />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Incident</TH>
                <TH>Facility / branch</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
                <TH>Assignee</TH>
                <TH>Opened</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {incidents.map((row) => (
                <IncidentRow
                  key={row.id}
                  canManage={canManage}
                  canAddAction={canAddAction}
                  users={users}
                  incident={{
                    id: row.id,
                    status: row.status,
                    priority: row.priority,
                    facilityId: row.facilityId,
                    facilityName: row.facility.name,
                    branchName: row.branch?.name,
                    assigneeId: row.assigneeId,
                    assigneeName: row.assignee?.name,
                    createdAt: row.createdAt.toISOString(),
                    updatedAt: row.updatedAt.toISOString(),
                    actionCount: row._count.actions,
                    resolutionInfo: row.resolutionInfo,
                  }}
                />
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
