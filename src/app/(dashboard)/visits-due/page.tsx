/** Facilities whose visit recommendation is due, recommended, or urgent. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds } from "@/lib/permissions";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TonePill } from "@/components/ui/status-pill";
import { IllustratedEmpty } from "@/components/empty-state";
import { ScopeFilter } from "@/components/scope-filter";
import { labelize } from "@/lib/utils";
import { ListFilters } from "@/components/list-filters";

function toneFor(recommendation: string) {
  if (recommendation === "URGENT_VISIT") return "danger" as const;
  if (recommendation === "VISIT_DUE") return "warn" as const;
  return "neutral" as const;
}

export default async function VisitsDuePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; facilityId?: string; organizationId?: string; recommendation?: string }>;
}) {
  const user = await requireUser();
  const { scope, facilityId, organizationId, recommendation } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const scopedIds = facilityId && ids.includes(facilityId) ? [facilityId] : ids;
  const [facilities, organizations] = await Promise.all([
    prisma.facility.findMany({
      where: {
        id: { in: scopedIds },
        ...(organizationId ? { clientOrganizationId: organizationId } : {}),
      },
      include: { clientOrganization: true },
      orderBy: { name: "asc" },
    }),
    prisma.clientOrganization.findMany({
      where: { facilities: { some: { id: { in: ids } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const facilityOptions = await prisma.facility.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rows = [];
  for (const facility of facilities) {
    const rec = await calculateVisitRecommendation(facility.id);
    if (rec.recommendation === "NOT_DUE") continue;
    if (recommendation && rec.recommendation !== recommendation) continue;
    rows.push({ facility, rec });
  }
  rows.sort((a, b) => {
    const rank: Record<string, number> = { URGENT_VISIT: 0, VISIT_DUE: 1, VISIT_RECOMMENDED: 2 };
    return (rank[a.rec.recommendation] ?? 9) - (rank[b.rec.recommendation] ?? 9);
  });

  return (
    <div>
      <PageHeader
        title="Visits due"
        description="Facilities that need a visit, based on the last site visit and open work."
        illustration="/brand/illustrations/page-calendar.png"
        actions={<ScopeFilter />}
      />
      <ListFilters
        exportPath="/api/export/visits-due"
        fields={[
          {
            name: "facilityId",
            label: "Facility",
            kind: "select",
            emptyLabel: "All facilities",
            options: facilityOptions.map((row) => ({ value: row.id, label: row.name })),
          },
          {
            name: "organizationId",
            label: "Organization",
            kind: "select",
            emptyLabel: "All organizations",
            options: organizations.map((row) => ({ value: row.id, label: row.name })),
          },
          {
            name: "recommendation",
            label: "Recommendation",
            kind: "select",
            options: [
              { value: "URGENT_VISIT", label: "Urgent visit" },
              { value: "VISIT_DUE", label: "Visit due" },
              { value: "VISIT_RECOMMENDED", label: "Visit recommended" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <IllustratedEmpty
          title="No visits are due right now."
          image="/brand/illustrations/page-calendar.png"
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Facility</TH>
                <TH>Organization</TH>
                <TH>Recommendation</TH>
                <TH>Days since last visit</TH>
                <TH>Why</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(({ facility, rec }) => (
                <TR key={facility.id}>
                  <TD>
                    <Link className="text-brand" href={`/facilities/${facility.id}`}>
                      {facility.name}
                    </Link>
                  </TD>
                  <TD>{facility.clientOrganization.name}</TD>
                  <TD>
                    <TonePill tone={toneFor(rec.recommendation)}>
                      {labelize(rec.recommendation)}
                    </TonePill>
                  </TD>
                  <TD className="font-mono text-[12px]">
                    {rec.daysSinceLastVisit == null ? "—" : rec.daysSinceLastVisit}
                  </TD>
                  <TD className="text-[13px] text-slate">{rec.reason || "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
