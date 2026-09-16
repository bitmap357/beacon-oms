/** QA records for accessible facilities. Create via QaForm → POST /api/qa-records */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader, CollapsibleSection } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, incidentLabel, labelize } from "@/lib/utils";
import { ScopeFilter } from "@/components/scope-filter";
import { QaForm } from "@/components/qa-form";
import { EditDeleteControls } from "@/components/record-actions";
import { IllustratedEmpty } from "@/components/empty-state";

export default async function QAPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; incidentId?: string }>;
}) {
  const user = await requireUser();
  const { scope, incidentId } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const [records, facilities, incidents] = await Promise.all([
    prisma.qARecord.findMany({
      where: { facilityId: { in: ids } },
      include: { facility: true, qaUser: true, relatedIncident: true },
      orderBy: { qaDate: "desc" },
    }),
    prisma.facility.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.incident.findMany({
      where: { facilityId: { in: ids } },
      select: { id: true, facilityId: true, createdAt: true, reportedAt: true, description: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const canManage = hasPermission(user.role, "qa.manage");

  return (
    <div>
      <PageHeader
        title="QA"
        description="Verification of incident resolutions and deployments."
        illustration="/brand/illustrations/page-qa.png"
        actions={<ScopeFilter />}
      />
      <CollapsibleSection title="Record QA" defaultOpen={Boolean(incidentId)}>
        <QaForm
          facilities={facilities}
          incidents={incidents}
          defaultIncidentId={incidentId}
        />
      </CollapsibleSection>
      {records.length === 0 ? (
        <IllustratedEmpty
          title="No QA records yet. Record a verification above."
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
                  <TD>{labelize(row.result)}</TD>
                  <TD>{row.qaUser.name}</TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.qaDate)}</TD>
                  <TD>
                    {row.relatedIncident ? incidentLabel(row.relatedIncident) : "—"}
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
