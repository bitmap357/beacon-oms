/** Incident inbox + Excel import. New incident: /incidents/new */
import { Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { IncidentForm, IncidentImportForm } from "@/components/incident-forms";
import { IncidentInbox } from "@/components/incident-row";
import { IncidentFilters } from "@/components/incident-filters";
import { ScopeFilter } from "@/components/scope-filter";
import { IllustratedEmpty } from "@/components/empty-state";
import { OPEN_INCIDENT_STATUS_QUERY, incidentStatusesForFilter } from "@/lib/incident-status";

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
  const statusValues = incidentStatusesForFilter(query.status);
  const [incidents, facilities, users] = await Promise.all([
    prisma.incident.findMany({
      where: {
        facilityId: { in: scopedIds },
        ...(query.mine === "1" ? { assigneeId: user.id } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(statusValues ? { status: { in: statusValues } } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.withoutActions === "1"
          ? {
              ...(!query.status ? { status: { in: [...OPEN_INCIDENT_STATUS_QUERY] } } : {}),
              actions: { none: {} },
            }
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
        <IncidentInbox
          canManage={canManage}
          canUpdate={canUpdate}
          canClose={canClose}
          canAddAction={canAddAction}
          users={users}
          incidents={incidents.map((row) => ({
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
          }))}
        />
      )}
      <details
        className="mt-6 rounded-2xl border border-hairline bg-surface-raised p-5"
        open={query.add === "1"}
      >
        <summary className="font-heading flex cursor-pointer list-none items-center gap-2 text-[16px] md:text-[18px]">
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
