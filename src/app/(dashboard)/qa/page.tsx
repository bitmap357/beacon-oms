/** QA records for accessible facilities. Create via SimpleForm → POST /api/qa-records */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm } from "@/components/forms";
import { formatDate, labelize } from "@/lib/utils";

export default async function QAPage() {
  const user = await requireUser();
  const ids = await getAccessibleFacilityIds(user);
  const [records, facilities, incidents] = await Promise.all([
    prisma.qARecord.findMany({
      where: { facilityId: { in: ids } },
      include: { facility: true, qaUser: true, relatedIncident: true },
      orderBy: { qaDate: "desc" },
    }),
    prisma.facility.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.incident.findMany({
      where: { facilityId: { in: ids } },
      select: { id: true, title: true },
      take: 50,
    }),
  ]);

  return (
    <div>
      <PageHeader title="QA" description="Verification of incident resolutions and deployments." />
      <Card className="mb-6 p-5">
        <SimpleForm
          action="/api/qa-records"
          submitLabel="Record QA"
          fields={[
            {
              name: "facilityId",
              label: "Facility",
              required: true,
              options: facilities.map((row) => ({ value: row.id, label: row.name })),
            },
            {
              name: "relatedIncidentId",
              label: "Related incident",
              options: [{ value: "", label: "None" }, ...incidents.map((row) => ({ value: row.id, label: row.title }))],
            },
            { name: "qaDate", label: "QA date", type: "date", required: true },
            {
              name: "result",
              label: "Result",
              required: true,
              options: ["PASSED", "FAILED", "PASSED_WITH_ISSUES", "REQUIRES_RETEST"].map((value) => ({
                value,
                label: labelize(value),
              })),
            },
            { name: "findings", label: "Findings", textarea: true },
          ]}
        />
      </Card>
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Facility</TH>
              <TH>Result</TH>
              <TH>QA person</TH>
              <TH>Date</TH>
              <TH>Incident</TH>
            </TR>
          </THead>
          <TBody>
            {records.map((row) => (
              <TR key={row.id}>
                <TD>{row.facility.name}</TD>
                <TD>{labelize(row.result)}</TD>
                <TD>{row.qaUser.name}</TD>
                <TD className="font-mono text-[12px]">{formatDate(row.qaDate)}</TD>
                <TD>{row.relatedIncident?.title || "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
