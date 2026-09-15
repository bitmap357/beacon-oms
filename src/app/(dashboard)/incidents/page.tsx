/** Incident inbox + Excel import. New incident: /incidents/new */
import { Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TH, THead, TR } from "@/components/ui/table";
import { IncidentForm, IncidentImportForm } from "@/components/incident-forms";
import { IncidentRow } from "@/components/incident-row";
import { IncidentFilters } from "@/components/incident-filters";
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
    add?: string;
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
  const canUpdate = hasPermission(user.role, "incidents.create") || canManage;
  const canClose = hasPermission(user.role, "qa.manage");
  const canAddAction = hasPermission(user.role, "actions.manage");

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Work the list first. Open Add incidents when you need to log one or bulk upload."
        illustration="/brand/illustrations/page-incidents.png"
        actions={<ScopeFilter includeMine />}
      />
      <IncidentFilters />
      {incidents.length === 0 ? (
        <IllustratedEmpty
          title="No incidents in this view yet. Add one below, or switch the filter to All."
          image="/brand/illustrations/page-incidents.png"
        />
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
                <TH>Date reported</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {incidents.map((row) => (
                <IncidentRow
                  key={row.id}
                  canManage={canManage}
                  canUpdate={canUpdate}
                  canClose={canClose}
                  canAddAction={canAddAction}
                  users={users}
                  incident={{
                    id: row.id,
                    status: row.status,
                    priority: row.priority,
                    description: row.description,
                    facilityId: row.facilityId,
                    facilityName: row.facility.name,
                    branchName: row.branch?.name,
                    assigneeId: row.assigneeId,
                    assigneeName: row.assignee?.name,
                    createdAt: row.createdAt.toISOString(),
                    reportedAt: row.reportedAt.toISOString(),
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
      <details
        className="mt-6 rounded-2xl border border-hairline bg-surface-raised p-5"
        open={query.add === "1"}
      >
        <summary className="font-heading flex cursor-pointer list-none items-center gap-2 text-[18px]">
          <Plus className="h-4 w-4 text-brand" />
          Add incidents
        </summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div>
            <h2 className="font-heading mb-3 flex items-center gap-2 text-[16px]">
              <Plus className="h-4 w-4 text-brand" />
              Report one
            </h2>
            <IncidentForm
              facilities={facilities}
              users={users}
              defaultFacilityId={query.facilityId}
              canClose={canClose}
            />
          </div>
          <div>
            <h2 className="font-heading mb-3 flex items-center gap-2 text-[16px]">
              <Upload className="h-4 w-4 text-brand" />
              Bulk upload
            </h2>
            <IncidentImportForm facilities={facilities} facilityId={query.facilityId} />
          </div>
        </div>
      </details>
    </div>
  );
}
