/** Client orgs + regions. Tree UI: src/components/org-tree.tsx */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page";
import { OrganizationTree } from "@/components/org-tree";

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
        description="Spagad owns facilities. Facilities optionally have branches. Incidents, actions, and reports hang off that tree."
      />
      <OrganizationTree
        canManage={user.role === "ADMIN"}
        organizations={organizations}
      />
    </div>
  );
}
