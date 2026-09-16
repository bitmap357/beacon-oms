/** Client orgs + regions. Tree UI: src/components/org-tree.tsx */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { OrganizationTree } from "@/components/org-tree";
import { hasPermission } from "@/lib/permissions";

export default async function OrganizationsPage() {
  const user = await requireUser();
  assertPermission(user, "orgs.read");
  const organizations = await prisma.clientOrganization.findMany({
    include: {
      facilities: {
        include: {
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
      <OrganizationTree
        canManageOrgs={hasPermission(user.role, "orgs.manage")}
        canManageFacilities={hasPermission(user.role, "facilities.manage")}
        organizations={organizations}
      />
    </div>
  );
}
