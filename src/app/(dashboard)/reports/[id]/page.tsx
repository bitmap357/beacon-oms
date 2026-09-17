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
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, labelize } from "@/lib/utils";
import {
  REPORT_SECTIONS,
  labelFor,
  formatReportValue,
  reportTitleFor,
  type ActionReportRow,
  type IncidentReportRow,
  type ReportRecord,
  type UnitEngagedRow,
} from "@/lib/reportTemplates";
import type { ReportType } from "@/lib/db-types";
import { parseJson } from "@/lib/db-types";
import { DeleteButton } from "@/components/record-actions";
import { ReportStatusPill } from "@/components/ui/status-pill";
import { FacilityLogoMark } from "@/components/facility-logo";

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
  const meta =
    content.summaryMeta && typeof content.summaryMeta === "object" && !Array.isArray(content.summaryMeta)
      ? (content.summaryMeta as Record<string, unknown>)
      : null;
  const units = Array.isArray(content.unitsEngaged) ? (content.unitsEngaged as UnitEngagedRow[]) : [];
  const incidents = Array.isArray(content.incidentRows) ? (content.incidentRows as IncidentReportRow[]) : [];
  const actions = Array.isArray(content.actionRows) ? (content.actionRows as ActionReportRow[]) : [];
  const skip = new Set(["incidentRows", "actionRows", "summaryMeta", "unitsEngaged", "purpose", "visitPurpose"]);
  if (meta) skip.add("scope");
  if (incidents.length) {
    skip.add("keyIncidents");
    skip.add("incidentCount");
    skip.add("openIncidents");
    skip.add("closedIncidents");
    skip.add("incidentsByPriority");
    skip.add("incidentsByFacility");
  }
  if (actions.length) {
    skip.add("outstandingActions");
    skip.add("actionCount");
    skip.add("overdueActions");
    skip.add("completedActions");
  }
  const purpose = formatReportValue(content.purpose || content.visitPurpose);
  const title = reportTitleFor(type as ReportRecord["type"]);
  const toc: string[] = [];
  if (purpose !== "—") toc.push("Purpose of visit");
  if (meta) toc.push("Summary of visit");
  if (units.length) toc.push("Units engaged");
  for (const key of sections) {
    if (skip.has(key)) continue;
    if (formatReportValue(content[key]) === "—") continue;
    toc.push(labelFor(key));
  }
  if (incidents.length) toc.push("Issues identified / incidents");
  if (actions.length) toc.push("Actions");

  let section = 0;
  function nextHeading(label: string) {
    section += 1;
    return `${section}.0 ${label}`;
  }

  return (
    <div>
      <PageHeader
        title={labelize(report.type) + " report"}
        description={`${report.facility.clientOrganization.name} · ${report.facility.name}`}
        illustration="/brand/illustrations/page-reports.png"
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
            <DeleteButton path={`/api/reports/${report.id}`} redirectTo="/reports" />
          </div>
        }
      />
      <p className="mb-4 text-[13px] text-slate">
        PDF is the formatted client-facing export. Word and Excel are data extracts (tables/titles).
      </p>
      <Card className="mb-4 p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-slate">Status</dt>
            <dd>
              <ReportStatusPill status={report.status} />
            </dd>
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
      <article className="overflow-hidden rounded-2xl border border-hairline bg-surface-raised">
        <div className="flex items-center justify-between gap-4 border-b-[3px] border-brand-deep px-5 py-4 sm:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lockup.png" alt="Beacon" className="h-12 w-auto max-w-[180px] object-contain" />
          {report.facility.logoS3Key ? (
            <FacilityLogoMark
              facilityId={report.facilityId}
              hasLogo
              name={report.facility.name}
              size={56}
            />
          ) : null}
        </div>
        <div className="px-5 py-8 sm:px-8">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-slate">
            Beacon operations management system
          </p>
          <h1 className="font-heading mt-2 text-center text-[26px] tracking-[0.06em] text-brand-deep sm:text-[30px]">
            {title}
          </h1>
          <p className="mt-2 text-center text-sm text-slate">
            {report.facility.name} · {report.facility.clientOrganization.name}
            <br />
            Report date {formatDate(report.date)} · Prepared by {report.author.name}
          </p>

          {toc.length ? (
            <nav className="mt-8 rounded-lg border border-hairline bg-surface px-4 py-3">
              <h2 className="font-heading mb-2 text-[16px] text-brand-deep">Table of contents</h2>
              <ol className="space-y-1 text-sm text-ink">
                {toc.map((item, index) => (
                  <li key={item}>{`${index + 1}.0 ${item}`}</li>
                ))}
              </ol>
            </nav>
          ) : null}

          {purpose !== "—" ? (
            <section className="mt-8">
              <h2 className="font-heading mb-2 border-b-2 border-gold pb-1 text-[18px] text-brand-deep">
                {nextHeading("Purpose of visit")}
              </h2>
              <p className="whitespace-pre-wrap text-sm">{purpose}</p>
            </section>
          ) : null}

          {meta ? (
            <section className="mt-8">
              <h2 className="font-heading mb-2 border-b-2 border-gold pb-1 text-[18px] text-brand-deep">
                {nextHeading("Summary of visit")}
              </h2>
              <Table>
                <TBody>
                  {Object.entries(meta).map(([key, value]) => (
                    <TR key={key}>
                      <TH className="w-[28%] bg-status-brand-bg text-status-brand-fg">{labelFor(key)}</TH>
                      <TD>{formatReportValue(value)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ) : null}

          {units.length ? (
            <section className="mt-8">
              <h2 className="font-heading mb-2 border-b-2 border-gold pb-1 text-[18px] text-brand-deep">
                {nextHeading("Units engaged")}
              </h2>
              <Table>
                <THead className="bg-brand-deep">
                  <TR>
                    <TH className="text-white">#</TH>
                    <TH className="text-white">Unit</TH>
                    <TH className="text-white">Planned</TH>
                    <TH className="text-white">Actual</TH>
                  </TR>
                </THead>
                <TBody>
                  {units.map((row, index) => (
                    <TR key={`${row.name}-${index}`}>
                      <TD>{index + 1}</TD>
                      <TD>{row.name || "—"}</TD>
                      <TD>{row.planned ? "✓" : ""}</TD>
                      <TD>{row.actual ? "✓" : ""}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ) : null}

          {sections.map((key) => {
            if (skip.has(key)) return null;
            const text = formatReportValue(content[key]);
            if (text === "—") return null;
            return (
              <section key={key} className="mt-8">
                <h2 className="font-heading mb-2 border-b-2 border-gold pb-1 text-[18px] text-brand-deep">
                  {nextHeading(labelFor(key))}
                </h2>
                <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
              </section>
            );
          })}

          {incidents.length ? (
            <section className="mt-8">
              <h2 className="font-heading mb-2 border-b-2 border-gold pb-1 text-[18px] text-brand-deep">
                {nextHeading("Issues identified / incidents")}
              </h2>
              <Table>
                <THead className="bg-brand-deep">
                  <TR>
                    <TH className="text-white">Unit</TH>
                    <TH className="text-white">Issue / incident</TH>
                    <TH className="text-white">Date reported</TH>
                    <TH className="text-white">Status</TH>
                    <TH className="text-white">Priority</TH>
                  </TR>
                </THead>
                <TBody>
                  {incidents.map((row, index) => (
                    <TR key={`${row.issue}-${index}`}>
                      <TD>{row.unit || "—"}</TD>
                      <TD>{row.issue || "—"}</TD>
                      <TD className="font-mono text-[12px]">{row.dateReported || "—"}</TD>
                      <TD>{row.status || "—"}</TD>
                      <TD>{row.priority || "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ) : null}

          {actions.length ? (
            <section className="mt-8">
              <h2 className="font-heading mb-2 border-b-2 border-gold pb-1 text-[18px] text-brand-deep">
                {nextHeading("Actions")}
              </h2>
              <Table>
                <THead className="bg-brand-deep">
                  <TR>
                    <TH className="text-white">Action</TH>
                    <TH className="text-white">Owner</TH>
                    <TH className="text-white">Due</TH>
                    <TH className="text-white">Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {actions.map((row, index) => (
                    <TR key={`${row.title}-${index}`}>
                      <TD>{row.title || "—"}</TD>
                      <TD>{row.owner || "—"}</TD>
                      <TD className="font-mono text-[12px]">{row.due || "—"}</TD>
                      <TD>{row.status || "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}
