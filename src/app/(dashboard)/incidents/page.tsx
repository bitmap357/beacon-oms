/** Incident inbox + Excel import. New incident: /incidents/new */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TonePill } from "@/components/ui/status-pill";
import { IncidentForm, IncidentImportForm } from "@/components/incident-forms";
import { formatDate, labelize } from "@/lib/utils";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string }>;
}) {
  const user = await requireUser();
  const { facilityId } = await searchParams;
  const ids = await getAccessibleFacilityIds(user);
  const scopedIds = facilityId && ids.includes(facilityId) ? [facilityId] : ids;
  const [incidents, facilities, users] = await Promise.all([
    prisma.incident.findMany({
      where: { facilityId: { in: scopedIds } },
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

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Log one incident at a time, or upload a bulk Excel sheet. Each incident belongs to a facility (and optional branch) and should have follow-up actions."
      />
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Report one incident</h2>
          <IncidentForm
            facilities={facilities}
            users={users}
            defaultFacilityId={facilityId}
          />
        </Card>
        <Card className="p-5">
          <h2 className="font-heading mb-3 text-[18px]">Bulk upload</h2>
          <IncidentImportForm />
        </Card>
      </div>
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
            </TR>
          </THead>
          <TBody>
            {incidents.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link className="text-brand" href={`/incidents/${row.id}`}>
                    {row.title}
                  </Link>
                </TD>
                <TD>
                  <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                    {row.facility.name}
                  </Link>
                  {row.branch ? <span className="text-slate"> · {row.branch.name}</span> : null}
                </TD>
                <TD>
                  <TonePill tone={row.priority === "CRITICAL" || row.priority === "HIGH" ? "danger" : "warn"}>
                    {labelize(row.priority)}
                  </TonePill>
                </TD>
                <TD>{labelize(row.status)}</TD>
                <TD>
                  <Link className="text-brand" href={`/actions?incidentId=${row.id}`}>
                    {row._count.actions}
                  </Link>
                </TD>
                <TD>{row.assignee?.name || "—"}</TD>
                <TD className="font-mono text-[12px]">{formatDate(row.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
