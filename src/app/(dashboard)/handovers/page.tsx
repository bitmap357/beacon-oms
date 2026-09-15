/** Handover list. Start a handover from the facility page so the snapshot is built server-side. */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { IllustratedEmpty } from "@/components/empty-state";
import { HandoverSnapshot } from "@/components/handover-snapshot";

export default async function HandoversPage() {
  const user = await requireUser();
  const ids = await getScopedFacilityIds(user);
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
        description="Start a handover from a facility page so the snapshot of open work is saved with the record."
        illustration="/brand/illustrations/page-handovers.png"
      />
      {handovers.length === 0 ? (
        <IllustratedEmpty
          title="No handovers yet. Open a facility and start one so coverage and open work are captured."
          image="/brand/illustrations/page-handovers.png"
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Facility</TH>
                <TH>From</TH>
                <TH>To</TH>
                <TH>Initiated by</TH>
                <TH>Snapshot</TH>
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
                  <TD>
                    <HandoverSnapshot value={row.summarySnapshot} />
                  </TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
