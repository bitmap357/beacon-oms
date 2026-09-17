/** QA queue (completed incidents waiting to close) plus verification records. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader, CollapsibleSection } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, incidentLabel, labelize } from "@/lib/utils";
import { ScopeFilter } from "@/components/scope-filter";
import { ListFilters } from "@/components/list-filters";
import { QaForm } from "@/components/qa-form";
import { EditDeleteControls } from "@/components/record-actions";
import { IllustratedEmpty } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { dateRange, incidentStatusesForFilter } from "@/lib/incident-status";
import { IncidentStatusPill, QaResultPill } from "@/components/ui/status-pill";

export default async function QAPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    incidentId?: string;
    facilityId?: string;
    assigneeId?: string;
    from?: string;
    to?: string;
    result?: string;
    qaUserId?: string;
  }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const ids = await getScopedFacilityIds(user, query.scope);
  const scopedIds =
    query.facilityId && ids.includes(query.facilityId) ? [query.facilityId] : ids;
  const completedStatuses = incidentStatusesForFilter("COMPLETED") || ["COMPLETED"];
  const range = dateRange(query.from, query.to);
  const [
    queue,
    records,
    facilities,
    incidents,
    users,
  ] = await Promise.all([
    prisma.incident.findMany({
      where: {
        facilityId: { in: scopedIds },
        status: { in: completedStatuses },
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(range ? { resolvedAt: range } : {}),
      },
      include: { facility: true, branch: true, assignee: true },
      orderBy: { resolvedAt: "desc" },
    }),
    prisma.qARecord.findMany({
      where: {
        facilityId: { in: scopedIds },
        ...(query.result ? { result: query.result } : {}),
        ...(query.qaUserId ? { qaUserId: query.qaUserId } : {}),
        ...(range ? { qaDate: range } : {}),
      },
      include: { facility: true, qaUser: true, relatedIncident: true },
      orderBy: { qaDate: "desc" },
    }),
    prisma.facility.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.incident.findMany({
      where: { facilityId: { in: ids } },
      select: {
        id: true,
        facilityId: true,
        createdAt: true,
        reportedAt: true,
        description: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canManage = hasPermission(user.role, "qa.manage");
  const facilityOptions = facilities.map((row) => ({ value: row.id, label: row.name }));
  const userOptions = users.map((row) => ({ value: row.id, label: row.name }));

  return (
    <div>
      <PageHeader
        title="QA"
        description="Completed incidents wait here until PM/QA verifies and closes them."
        illustration="/brand/illustrations/page-qa.png"
        actions={<ScopeFilter />}
      />
      <ListFilters
        exportPath="/api/export/qa-queue"
        fields={[
          { name: "facilityId", label: "Facility", kind: "select", options: facilityOptions, emptyLabel: "All facilities" },
          { name: "assigneeId", label: "Assignee", kind: "select", options: userOptions, emptyLabel: "Anyone" },
          { name: "from", label: "From", kind: "date" },
          { name: "to", label: "To", kind: "date" },
        ]}
      />
      <Card className="mb-6 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Waiting to be closed</h2>
        {queue.length === 0 ? (
          <p className="text-sm text-slate">No completed incidents are waiting for QA right now.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Incident</TH>
                <TH>Facility</TH>
                <TH>Assignee</TH>
                <TH>Completed</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {queue.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <Link className="text-brand" href={`/incidents/${row.id}`}>
                      {incidentLabel(row)}
                    </Link>
                    <IncidentStatusPill status={row.status} />
                  </TD>
                  <TD>
                    <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                      {row.facility.name}
                    </Link>
                    {row.branch ? <span className="block text-[12px] text-slate">{row.branch.name}</span> : null}
                  </TD>
                  <TD>{row.assignee?.name || "—"}</TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.resolvedAt)}</TD>
                  <TD>
                    {canManage ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/qa?incidentId=${row.id}`}>Record QA</Link>
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {canManage ? (
        <CollapsibleSection title="Record QA" defaultOpen={Boolean(query.incidentId)}>
          <QaForm
            facilities={facilities}
            incidents={incidents}
            defaultIncidentId={query.incidentId}
            defaultFacilityId={query.facilityId}
          />
        </CollapsibleSection>
      ) : null}
      <h2 className="font-heading mb-3 text-[18px]">QA records</h2>
      <ListFilters
        exportPath="/api/export/qa"
        fields={[
          { name: "facilityId", label: "Facility", kind: "select", options: facilityOptions, emptyLabel: "All facilities" },
          {
            name: "result",
            label: "Result",
            kind: "select",
            options: ["PASSED", "FAILED", "PASSED_WITH_ISSUES", "REQUIRES_RETEST"].map((value) => ({
              value,
              label: labelize(value),
            })),
          },
          { name: "qaUserId", label: "QA person", kind: "select", options: userOptions, emptyLabel: "Anyone" },
          { name: "from", label: "From", kind: "date" },
          { name: "to", label: "To", kind: "date" },
        ]}
      />
      {records.length === 0 ? (
        <IllustratedEmpty
          title="No QA records in this view yet."
          image="/brand/illustrations/page-qa.png"
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Facility</TH>
                <TH>Result</TH>
                <TH>QA person</TH>
                <TH>Date</TH>
                <TH>Incident</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {records.map((row) => (
                <TR key={row.id}>
                  <TD>{row.facility.name}</TD>
                  <TD>
                    <QaResultPill result={row.result} />
                  </TD>
                  <TD>{row.qaUser.name}</TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.qaDate)}</TD>
                  <TD>
                    {row.relatedIncident ? (
                      <Link className="text-brand" href={`/incidents/${row.relatedIncident.id}`}>
                        {incidentLabel(row.relatedIncident)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    {canManage ? (
                      <EditDeleteControls
                        compact
                        path={`/api/qa-records/${row.id}`}
                        fields={[
                          {
                            name: "result",
                            label: "Result",
                            options: ["PASSED", "FAILED", "PASSED_WITH_ISSUES", "REQUIRES_RETEST"].map(
                              (value) => ({ value, label: labelize(value) }),
                            ),
                            defaultValue: row.result,
                          },
                          {
                            name: "findings",
                            label: "Findings",
                            textarea: true,
                            defaultValue: row.findings || "",
                          },
                        ]}
                      />
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
