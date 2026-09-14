/** List + generate reports. Generate form redirects to /reports/[id]. */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm, GenerateReportForm } from "@/components/forms";
import { formatDate, labelize } from "@/lib/utils";
import { REPORT_SECTIONS } from "@/lib/reportTemplates";
import Link from "next/link";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string }>;
}) {
  const user = await requireUser();
  const { facilityId } = await searchParams;
  const ids = await getAccessibleFacilityIds(user);
  const scopedIds = facilityId && ids.includes(facilityId) ? [facilityId] : ids;
  const [reports, facilities] = await Promise.all([
    prisma.report.findMany({
      where: { facilityId: { in: scopedIds } },
      include: { facility: true, author: true },
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

  const contentFields = REPORT_SECTIONS.SITE_VISIT.map((key) => ({
    name: `content.${key}`,
    label: key.replace(/([A-Z])/g, " $1"),
    textarea: true,
  }));

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate operational reports from incidents and actions over a date range, or write a structured site visit."
      />
      <Card className="mb-6 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Generate from incidents & actions</h2>
        <p className="mb-3 text-[13px] text-slate">
          Beacon summarizes the incidents and follow-up actions in the selected window for a facility
          (and optional branch).
        </p>
        <GenerateReportForm facilities={facilities} />
      </Card>
      <Card className="mb-6 p-5">
        <h2 className="font-heading mb-3 text-[18px]">Create site visit report</h2>
        <SimpleForm
          action="/api/reports"
          submitLabel="Create site visit report"
          fields={[
            {
              name: "type",
              label: "Type",
              options: Object.keys(REPORT_SECTIONS)
                .filter((value) => value !== "OPERATIONAL")
                .map((value) => ({
                  value,
                  label: labelize(value),
                })),
            },
            {
              name: "facilityId",
              label: "Facility",
              required: true,
              options: facilities.map((row) => ({ value: row.id, label: row.name })),
            },
            { name: "date", label: "Date", type: "date", required: true },
            ...contentFields.slice(0, 4),
          ]}
        />
      </Card>
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
            </TR>
          </THead>
          <TBody>
            {reports.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link className="text-brand" href={`/reports/${row.id}`}>
                    {labelize(row.type)}
                  </Link>
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
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
