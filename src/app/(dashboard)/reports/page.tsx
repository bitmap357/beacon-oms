/** List + generate reports. Generate form redirects to /reports/[id]. */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader, CollapsibleSection } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { GenerateReportForm } from "@/components/forms";
import { formatDate, labelize } from "@/lib/utils";
import Link from "next/link";
import { ScopeFilter } from "@/components/scope-filter";
import { EditDeleteControls } from "@/components/record-actions";
import { IllustratedEmpty } from "@/components/empty-state";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string; scope?: string }>;
}) {
  const user = await requireUser();
  const { facilityId, scope } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const scopedIds = facilityId && ids.includes(facilityId) ? [facilityId] : ids;
  const [reports, facilities] = await Promise.all([
    prisma.report.findMany({
      where: { facilityId: { in: scopedIds } },
      include: { facility: true, author: true, activity: { select: { id: true, type: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.facility.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        branches: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const canManage = hasPermission(user.role, "reports.manage");

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate an operational rollup from incidents and actions. Visit write-ups are attached when you log a site visit, demo, or training."
        illustration="/brand/illustrations/page-reports.png"
        actions={<ScopeFilter />}
      />
      <CollapsibleSection title="Generate from incidents & actions">
        <p className="mb-3 text-[13px] text-slate">
          Beacon summarizes the incidents and follow-up actions in the selected window for a facility
          (and optional branch).
        </p>
        <GenerateReportForm facilities={facilities} />
      </CollapsibleSection>
      {reports.length === 0 ? (
        <IllustratedEmpty
          title="No reports in this view yet. Generate one above."
          image="/brand/illustrations/page-reports.png"
        />
      ) : (
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Type</TH>
              <TH>Facility</TH>
              <TH>Period</TH>
              <TH>Author</TH>
              <TH>Status</TH>
              <TH>Export</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {reports.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link className="text-brand" href={`/reports/${row.id}`}>
                    {labelize(row.type)}
                  </Link>
                  {row.activity ? (
                    <span className="block text-[12px] text-slate">From a visit</span>
                  ) : null}
                </TD>
                <TD>
                  <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                    {row.facility.name}
                  </Link>
                </TD>
                <TD className="font-mono text-[12px]">
                  {row.periodStart && row.periodEnd
                    ? `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`
                    : formatDate(row.date)}
                </TD>
                <TD>{row.author.name}</TD>
                <TD>{labelize(row.status)}</TD>
                <TD className="space-x-2 text-[13px]">
                  <a className="text-brand" href={`/api/reports/${row.id}/export?format=pdf`}>
                    PDF
                  </a>
                  <a className="text-brand" href={`/api/reports/${row.id}/export?format=docx`}>
                    Word
                  </a>
                  <a className="text-brand" href={`/api/reports/${row.id}/export?format=xlsx`}>
                    Excel
                  </a>
                </TD>
                <TD>
                  {canManage ? (
                    <EditDeleteControls
                      compact
                      path={`/api/reports/${row.id}`}
                      fields={[
                        {
                          name: "status",
                          label: "Status",
                          options: ["DRAFT", "SUBMITTED", "REVIEWED"].map((value) => ({
                            value,
                            label: labelize(value),
                          })),
                          defaultValue: row.status,
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
