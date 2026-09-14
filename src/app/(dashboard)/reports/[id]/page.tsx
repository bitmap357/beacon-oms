/**
 * Full report view. content is JSON text — parseJson before reading section keys.
 * Export links hit /api/reports/[id]/export?format=pdf|docx|xlsx
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertFacilityAccess } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { formatDate, labelize } from "@/lib/utils";
import { REPORT_SECTIONS, labelFor, formatReportValue } from "@/lib/reportTemplates";
import type { ReportType } from "@/lib/db-types";
import { parseJson } from "@/lib/db-types";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      facility: { include: { clientOrganization: true } },
      author: true,
    },
  });
  if (!report) notFound();
  await assertFacilityAccess(user, report.facilityId);

  const type = report.type as ReportType;
  const sections = REPORT_SECTIONS[type] ?? [];
  const content = parseJson<Record<string, unknown>>(report.content, {});

  return (
    <div>
      <PageHeader
        title={`${labelize(report.type)} report`}
        description={`${report.facility.clientOrganization.name} · ${report.facility.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/reports">All reports</Link>
            </Button>
            <Button asChild variant="secondary">
              <a href={`/api/reports/${report.id}/export?format=pdf`}>PDF</a>
            </Button>
            <Button asChild variant="secondary">
              <a href={`/api/reports/${report.id}/export?format=docx`}>Word</a>
            </Button>
            <Button asChild>
              <a href={`/api/reports/${report.id}/export?format=xlsx`}>Excel</a>
            </Button>
          </div>
        }
      />
      <Card className="mb-4 p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-slate">Status</dt>
            <dd>{labelize(report.status)}</dd>
          </div>
          <div>
            <dt className="text-slate">Author</dt>
            <dd>{report.author.name}</dd>
          </div>
          <div>
            <dt className="text-slate">Date</dt>
            <dd className="font-mono text-[12px]">{formatDate(report.date)}</dd>
          </div>
          <div>
            <dt className="text-slate">Period</dt>
            <dd className="font-mono text-[12px]">
              {report.periodStart && report.periodEnd
                ? `${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`
                : "—"}
            </dd>
          </div>
        </dl>
      </Card>
      <div className="space-y-3">
        {sections.map((key) => {
          const value = content[key];
          const text = formatReportValue(value);
          return (
            <Card key={key} className="p-5">
              <h2 className="font-heading mb-2 text-[16px]">{labelFor(key)}</h2>
              <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
