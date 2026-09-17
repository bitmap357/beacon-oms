/** Facility list. Create org/facility from here if the user has facilities.manage. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { PageHeader, CollapsibleSection } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FacilityForm } from "@/components/forms";
import { formatDate } from "@/lib/utils";
import { ScopeFilter } from "@/components/scope-filter";
import { IllustratedEmpty } from "@/components/empty-state";
import { ListFilters } from "@/components/list-filters";
import { FacilityLogoMark } from "@/components/facility-logo";

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; userId?: string; status?: string; organizationId?: string; q?: string }>;
}) {
  const user = await requireUser();
  const { scope, userId, status, organizationId, q } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const attention = ["ATTENTION_REQUIRED", "AT_RISK", "CRITICAL"];
  const [facilities, organizations] = await Promise.all([
    prisma.facility.findMany({
      where: {
        id: { in: ids },
        ...(status === "attention" ? { status: { in: attention } } : {}),
        ...(status && status !== "attention" ? { status } : {}),
        ...(organizationId ? { clientOrganizationId: organizationId } : {}),
        ...(q ? { name: { contains: q } } : {}),
        ...(userId
          ? { assignments: { some: { userId, isActive: true } } }
          : {}),
      },
      include: {
        clientOrganization: true,
        region: true,
        branches: { orderBy: { name: "asc" } },
        assignments: {
          where: { isActive: true, isLead: true },
          include: { user: true },
        },
        _count: { select: { incidents: true, actions: true, reports: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.clientOrganization.findMany({
      orderBy: { name: "asc" },
      include: { regions: { orderBy: { name: "asc" } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Facilities"
        description="Each facility belongs to an organization. Some facilities have branches that incidents can be scoped to."
        illustration="/brand/illustrations/page-facilities.png"
        actions={<ScopeFilter />}
      />
      <ListFilters
        exportPath="/api/export/facilities"
        fields={[
          { name: "q", label: "Name", kind: "text", placeholder: "Facility name" },
          {
            name: "organizationId",
            label: "Organization",
            kind: "select",
            emptyLabel: "All organizations",
            options: organizations.map((row) => ({ value: row.id, label: row.name })),
          },
          {
            name: "status",
            label: "Status",
            kind: "select",
            options: [
              { value: "attention", label: "Needs attention" },
              { value: "HEALTHY", label: "Healthy" },
              { value: "ATTENTION_REQUIRED", label: "Attention required" },
              { value: "AT_RISK", label: "At risk" },
              { value: "CRITICAL", label: "Critical" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
        ]}
      />
      {hasPermission(user.role, "facilities.manage") ? (
        <CollapsibleSection title="Add facility">
          <FacilityForm organizations={organizations} />
        </CollapsibleSection>
      ) : null}
      {facilities.length === 0 ? (
        <IllustratedEmpty
          title="No facilities in this view."
          image="/brand/illustrations/page-facilities.png"
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Facility</TH>
                <TH>Organization</TH>
                <TH>Region</TH>
                <TH>Branches</TH>
                <TH>Lead PM/QA</TH>
                <TH>Lead Developer</TH>
                <TH>Work</TH>
                <TH>Status</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {facilities.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <Link className="flex items-center gap-2 text-brand" href={`/facilities/${row.id}`}>
                      <FacilityLogoMark
                        facilityId={row.id}
                        hasLogo={Boolean(row.logoS3Key)}
                        name={row.name}
                        size={28}
                      />
                      {row.name}
                    </Link>
                  </TD>
                  <TD>
                    <Link className="text-brand" href="/admin/organizations">
                      {row.clientOrganization.name}
                    </Link>
                  </TD>
                  <TD>{row.region?.name || "—"}</TD>
                  <TD>
                    {row.branches.length ? (
                      <Link className="text-brand" href={`/facilities/${row.id}#branches`}>
                        {row.branches.length}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    {row.assignments.find((assignment) => assignment.assignmentType === "PM_QA")?.user.name || "—"}
                  </TD>
                  <TD>
                    {row.assignments.find((assignment) => assignment.assignmentType === "DEVELOPER")?.user.name || "—"}
                  </TD>
                  <TD className="whitespace-nowrap text-[13px]">
                    <Link className="text-brand" href={`/incidents?facilityId=${row.id}`}>
                      {row._count.incidents} incidents
                    </Link>
                    {" · "}
                    <Link className="text-brand" href={`/actions?facilityId=${row.id}`}>
                      {row._count.actions} actions
                    </Link>
                  </TD>
                  <TD>
                    <StatusPill status={row.status} />
                  </TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
