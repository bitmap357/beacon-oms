/** Handover list. Start a handover from the facility page so the snapshot is built server-side. */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default async function HandoversPage() {
  const user = await requireUser();
  const ids = await getAccessibleFacilityIds(user);
  const handovers = await prisma.handover.findMany({
    where: { facilityId: { in: ids } },
    include: {
      facility: true,
      fromUser: true,
      toUser: true,
      initiatedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Handovers"
        description="Start a handover from a facility page so the snapshot is built server-side."
      />
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Facility</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Initiated by</TH>
              <TH>Date</TH>
            </TR>
          </THead>
          <TBody>
            {handovers.map((row) => (
              <TR key={row.id}>
                <TD>{row.facility.name}</TD>
                <TD>{row.fromUser?.name || "—"}</TD>
                <TD>{row.toUser?.name || "—"}</TD>
                <TD>{row.initiatedBy.name}</TD>
                <TD className="font-mono text-[12px]">{formatDate(row.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
