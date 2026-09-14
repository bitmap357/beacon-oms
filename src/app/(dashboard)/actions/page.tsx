/** Follow-up actions across facilities. Due dates also appear on the calendar in red. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SimpleForm } from "@/components/forms";
import { formatDate, labelize } from "@/lib/utils";
import { TonePill } from "@/components/ui/status-pill";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string; incidentId?: string }>;
}) {
  const user = await requireUser();
  const { facilityId, incidentId } = await searchParams;
  const ids = await getAccessibleFacilityIds(user);
  const scopedIds = facilityId && ids.includes(facilityId) ? [facilityId] : ids;
  const [actions, facilities, users, incidents] = await Promise.all([
    prisma.action.findMany({
      where: {
        facilityId: { in: scopedIds },
        ...(incidentId ? { incidentId } : {}),
      },
      include: { facility: true, owner: true, incident: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.facility.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.incident.findMany({
      where: {
        facilityId: { in: scopedIds },
        status: { in: ["NEW", "ASSIGNED", "IN_PROGRESS", "AWAITING_QA", "REOPENED"] },
      },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Actions"
        description="Follow-up work required by incidents, with owners and due dates."
      />
      <Card className="mb-6 p-5">
        <SimpleForm
          action="/api/actions"
          submitLabel="Create action"
          fields={[
            {
              name: "facilityId",
              label: "Facility",
              required: true,
              options: facilities.map((row) => ({ value: row.id, label: row.name })),
            },
            {
              name: "incidentId",
              label: "Related incident",
              options: [
                { value: incidentId || "", label: incidentId ? "Selected incident" : "None" },
                ...incidents
                  .filter((row) => row.id !== incidentId)
                  .map((row) => ({ value: row.id, label: row.title })),
              ],
            },
            { name: "title", label: "Title", required: true },
            {
              name: "ownerId",
              label: "Owner",
              required: true,
              options: users.map((row) => ({ value: row.id, label: row.name })),
            },
            {
              name: "priority",
              label: "Priority",
              required: true,
              options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({
                value,
                label: labelize(value),
              })),
            },
            { name: "dueDate", label: "Due date", type: "date", required: true },
            { name: "description", label: "Description", textarea: true },
          ]}
        />
      </Card>
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Action</TH>
              <TH>Incident</TH>
              <TH>Facility</TH>
              <TH>Owner</TH>
              <TH>Due</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {actions.map((row) => {
              const overdue =
                row.dueDate < now &&
                ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"].includes(row.status);
              return (
                <TR key={row.id}>
                  <TD>{row.title}</TD>
                  <TD>
                    {row.incident ? (
                      <Link className="text-brand" href={`/incidents/${row.incident.id}`}>
                        {row.incident.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    <Link className="text-brand" href={`/facilities/${row.facilityId}`}>
                      {row.facility.name}
                    </Link>
                  </TD>
                  <TD>{row.owner.name}</TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.dueDate)}</TD>
                  <TD>
                    <TonePill tone={overdue ? "danger" : row.status === "COMPLETED" ? "ok" : "neutral"}>
                      {overdue ? "Overdue" : labelize(row.status)}
                    </TonePill>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
