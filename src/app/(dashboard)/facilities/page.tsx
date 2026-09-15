/** Facility list. Create org/facility from here if the user has facilities.manage. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds, hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FacilityForm } from "@/components/forms";
import { formatDate } from "@/lib/utils";
import { ScopeFilter } from "@/components/scope-filter";
import { IllustratedEmpty } from "@/components/empty-state";

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; userId?: string; status?: string }>;
}) {
  const user = await requireUser();
  const { scope, userId, status } = await searchParams;
  const ids = await getScopedFacilityIds(user, scope);
  const attention = ["ATTENTION_REQUIRED", "AT_RISK", "CRITICAL"];
  const [facilities, organizations] = await Promise.all([
    prisma.facility.findMany({
      where: {
        id: { in: ids },
        ...(status === "attention" ? { status: { in: attention } } : {}),
        ...(status && status !== "attention" ? { status } : {}),
        ...(userId
          ? { assignments: { some: { userId, isActive: true } } }
          : {}),
      },
      include: {
        clientOrganization: true,
        branches: { orderBy: { name: "asc" } },
        assignments: {
          where: { isActive: true, isLead: true },
          include: { user: true },
        },
        _count: { select: { incidents: true, actions: true, reports: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.clientOrganization.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Facilities"
        description="Each facility belongs to an organization. Some facilities have branches that incidents can be scoped to."
        actions={<ScopeFilter />}
      />
      {hasPermission(user.role, "facilities.manage") ? (
        <Card className="mb-6 p-5">
          <h2 className="font-heading mb-3 text-[18px]">Add facility</h2>
          <FacilityForm organizations={organizations} />
        </Card>
      ) : null}
      {facilities.length === 0 ? (
        <IllustratedEmpty
          title="No facilities in this view."
          image="/brand/illustrations/empty-map.png"
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Facility</TH>
                <TH>Organization</TH>
                <TH>Branches</TH>
                <TH>Lead PM/QA</TH>
                <TH>Work</TH>
                <TH>Status</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {facilities.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <Link className="text-brand" href={`/facilities/${row.id}`}>
                      {row.name}
                    </Link>
                  </TD>
                  <TD>
                    <Link className="text-brand" href="/admin/organizations">
                      {row.clientOrganization.name}
                    </Link>
                  </TD>
                  <TD>
                    {row.branches.length
                      ? row.branches.map((branch) => branch.name).join(", ")
                      : "—"}
                  </TD>
                  <TD>{row.assignments[0]?.user.name || "—"}</TD>
                  <TD className="text-[13px]">
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
