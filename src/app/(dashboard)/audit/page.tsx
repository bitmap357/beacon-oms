/** Append-only audit log (admin). Writes happen in src/lib/audit.ts */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { ListFilters } from "@/components/list-filters";
import { dateRange } from "@/lib/incident-status";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entityType?: string;
    userId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requireUser();
  assertPermission(user, "audit.read");
  const { action, entityType, userId, from, to } = await searchParams;
  const range = dateRange(from, to);
  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(entityType ? { entityType } : {}),
        ...(userId ? { userId } : {}),
        ...(range ? { createdAt: range } : {}),
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Append-only history of important operational changes."
        illustration="/brand/illustrations/page-audit.png"
      />
      <ListFilters
        exportPath="/api/export/audit"
        fields={[
          { name: "action", label: "Action", kind: "text", placeholder: "Action contains" },
          { name: "entityType", label: "Entity", kind: "text", placeholder: "Entity type" },
          {
            name: "userId",
            label: "Person",
            kind: "select",
            emptyLabel: "Anyone",
            options: users.map((row) => ({ value: row.id, label: row.name })),
          },
          { name: "from", label: "From", kind: "date" },
          { name: "to", label: "To", kind: "date" },
        ]}
      />
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Who</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Previous → new</TH>
              <TH>IP</TH>
            </TR>
          </THead>
          <TBody>
            {logs.map((row) => (
              <TR key={row.id}>
                <TD className="font-mono text-[12px]">{formatDateTime(row.createdAt)}</TD>
                <TD>{row.user?.name || "System"}</TD>
                <TD>{row.action}</TD>
                <TD className="font-mono text-[12px]">
                  {row.entityType}
                  <br />
                  {row.entityId}
                </TD>
                <TD className="max-w-xs truncate text-[12px] text-slate">
                  {row.previousValue || "—"} → {row.newValue || "—"}
                </TD>
                <TD className="font-mono text-[12px]">{row.ipAddress || "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
