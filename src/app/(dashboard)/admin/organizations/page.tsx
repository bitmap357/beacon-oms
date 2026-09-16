/** Client orgs + regions. Tree UI: src/components/org-tree.tsx */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { OrganizationTree } from "@/components/org-tree";
import { hasPermission } from "@/lib/permissions";
import { ListFilters } from "@/components/list-filters";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  assertPermission(user, "orgs.read");
  const { q } = await searchParams;
  const query = q?.trim();
  const organizations = await prisma.clientOrganization.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { facilities: { some: { name: { contains: query } } } },
          ],
        }
      : {},
    include: {
      regions: { orderBy: { name: "asc" } },
      facilities: {
        include: {
          region: { select: { id: true, name: true } },
          branches: { orderBy: { name: "asc" } },
          _count: { select: { incidents: true, actions: true, reports: true } },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Rename an organization here. Site address lives on each facility and branch, not on the organization."
        illustration="/brand/illustrations/page-organizations.png"
      />
      <ListFilters
        exportPath="/api/export/organizations"
        fields={[{ name: "q", label: "Name", kind: "text", placeholder: "Organization or facility" }]}
      />
      <OrganizationTree
        canManageOrgs={hasPermission(user.role, "orgs.manage")}
        canManageFacilities={hasPermission(user.role, "facilities.manage")}
        organizations={organizations}
      />
    </div>
  );
}
