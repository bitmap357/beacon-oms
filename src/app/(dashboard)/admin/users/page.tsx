/** Admin user list. Roles display via formatRole. API: /api/users */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission, hasPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader, CollapsibleSection } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm } from "@/components/forms";
import { formatDateTime, formatRole } from "@/lib/utils";
import { CREDENTIAL_HINT } from "@/lib/password-policy";
import { ListFilters } from "@/components/list-filters";
import { UserAdminActions } from "@/components/user-admin-actions";

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const user = await requireUser();
  assertPermission(user, "users.read");
  const { q, role, status } = await searchParams;
  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
      ...(q?.trim()
        ? { OR: [{ name: { contains: q.trim() } }, { email: { contains: q.trim() } }] }
        : {}),
    },
    orderBy: { name: "asc" },
  });
  const canManage = user.role === "ADMIN";

  return (
    <div>
      <PageHeader
        title="Users"
        description="Roles, activation, and password resets."
        illustration="/brand/illustrations/page-users.png"
      />
      <ListFilters
        exportPath="/api/export/users"
        fields={[
          { name: "q", label: "Name or email", kind: "text", placeholder: "Search people" },
          {
            name: "role",
            label: "Role",
            kind: "select",
            options: [
              { value: "PM_QA", label: "PM/QA" },
              { value: "DEVELOPER", label: "Developer" },
              { value: "MANAGEMENT", label: "Management" },
              { value: "ADMIN", label: "Admin" },
            ],
          },
          {
            name: "status",
            label: "Status",
            kind: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Deactivated" },
            ],
          },
        ]}
      />
      {canManage ? (
        <CollapsibleSection title="Create user">
          <p className="mb-3 text-[12px] text-slate">{CREDENTIAL_HINT}</p>
          <SimpleForm
            action="/api/users"
            submitLabel="Create user"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              {
                name: "role",
                label: "Role",
                required: true,
                options: [
                  { value: "PM_QA", label: "PM/QA" },
                  { value: "DEVELOPER", label: "Developer" },
                  { value: "MANAGEMENT", label: "Management" },
                  { value: "ADMIN", label: "Admin" },
                ],
              },
              { name: "password", label: "Temporary password", type: "password", required: true },
            ]}
          />
        </CollapsibleSection>
      ) : null}
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Last login</TH>
              {canManage ? <TH></TH> : null}
            </TR>
          </THead>
          <TBody>
            {users.map((row) => (
              <TR key={row.id}>
                <TD>
                  <a className="text-brand" href={`/profile/${row.id}`}>
                    {row.name}
                  </a>
                </TD>
                <TD>{row.email}</TD>
                <TD>{formatRole(row.role)}</TD>
                <TD>{row.isActive ? "Active" : "Deactivated"}</TD>
                <TD className="font-mono text-[12px]">{formatDateTime(row.lastLoginAt)}</TD>
                {canManage ? (
                  <TD>
                    <UserAdminActions
                      userId={row.id}
                      name={row.name}
                      email={row.email}
                      role={row.role}
                      isActive={row.isActive}
                      isSelf={row.id === user.id}
                      canForceReset={hasPermission(user.role, "users.forceReset")}
                    />
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
