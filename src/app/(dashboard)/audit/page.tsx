/** Append-only audit log (admin). Writes happen in src/lib/audit.ts */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertPermission } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  assertPermission(user, "audit.read");
  const params = await searchParams;
  const action = typeof params.action === "string" ? params.action : undefined;
  const entityType = typeof params.entityType === "string" ? params.entityType : undefined;
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action: { contains: action } } : {}),
      ...(entityType ? { entityType } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const csv = [
    ["when", "who", "action", "entity", "entityId", "previous", "next", "ip"].join(","),
    ...logs.map((row) =>
      [
        row.createdAt.toISOString(),
        row.user?.email || "",
        row.action,
        row.entityType,
        row.entityId,
        row.previousValue || "",
        row.newValue || "",
        row.ipAddress || "",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Append-only history of important operational changes."
        illustration="/brand/illustrations/page-audit.png"
        actions={
          <a
            className="text-sm text-brand"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
            download="beacon-audit.csv"
          >
            Export CSV
          </a>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="action"
          placeholder="Action contains"
          defaultValue={action}
          className="h-9 rounded-[10px] border border-hairline px-3 text-sm"
        />
        <input
          name="entityType"
          placeholder="Entity type"
          defaultValue={entityType}
          className="h-9 rounded-[10px] border border-hairline px-3 text-sm"
        />
        <button className="h-9 rounded-[10px] bg-brand px-4 text-sm text-white">
          Filter
        </button>
      </form>
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
