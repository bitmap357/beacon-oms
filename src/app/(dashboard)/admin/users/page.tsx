/** Admin user list. Roles display via formatRole. API: /api/users */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm } from "@/components/forms";
import { formatDateTime, formatRole } from "@/lib/utils";
import { CREDENTIAL_HINT } from "@/lib/password";

export default async function UsersAdminPage() {
  const user = await requireUser();
  assertPermission(user, "users.read");
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  const canManage = user.role === "ADMIN";

  return (
    <div>
      <PageHeader title="Users" description="Roles, activation, and password resets." />
      {canManage ? (
        <Card className="mb-6 p-5">
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
        </Card>
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
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
