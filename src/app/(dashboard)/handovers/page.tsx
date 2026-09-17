/** Handover list. Start a handover from the facility page; admins approve pending transfers. */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, labelize } from "@/lib/utils";
import { IllustratedEmpty } from "@/components/empty-state";
import { HandoverSnapshot } from "@/components/handover-snapshot";
import { HandoverReviewButtons } from "@/components/handover-review-buttons";
import { ListFilters } from "@/components/list-filters";
import { dateRange } from "@/lib/incident-status";

export default async function HandoversPage({
  searchParams,
}: {
  searchParams: Promise<{
    facilityId?: string;
    fromUserId?: string;
    toUserId?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
}) {
  const user = await requireUser();
  const { facilityId, fromUserId, toUserId, from, to, status } = await searchParams;
  const ids = await getScopedFacilityIds(user);
  const scopedIds = facilityId && ids.includes(facilityId) ? [facilityId] : ids;
  const range = dateRange(from, to);
  const [handovers, facilities, users] = await Promise.all([
    prisma.handover.findMany({
      where: {
        facilityId: { in: scopedIds },
        ...(fromUserId ? { fromUserId } : {}),
        ...(toUserId ? { toUserId } : {}),
        ...(status ? { status } : {}),
        ...(range ? { createdAt: range } : {}),
      },
      include: {
        facility: true,
        fromUser: true,
        toUser: true,
        initiatedBy: true,
        reviewedBy: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.facility.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const people = users.map((row) => ({ value: row.id, label: row.name }));
  const isAdmin = user.role === "ADMIN";

  return (
    <div>
      <PageHeader
        title="Handovers"
        description="PM/QA requests a lead transfer from a facility page. Admins approve before the assignment changes."
        illustration="/brand/illustrations/page-handovers.png"
      />
      <ListFilters
        exportPath="/api/export/handovers"
        fields={[
          {
            name: "facilityId",
            label: "Facility",
            kind: "select",
            emptyLabel: "All facilities",
            options: facilities.map((row) => ({ value: row.id, label: row.name })),
          },
          {
            name: "status",
            label: "Status",
            kind: "select",
            emptyLabel: "Any status",
            options: [
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ],
          },
          { name: "fromUserId", label: "From", kind: "select", emptyLabel: "Anyone", options: people },
          { name: "toUserId", label: "To", kind: "select", emptyLabel: "Anyone", options: people },
          { name: "from", label: "From date", kind: "date" },
          { name: "to", label: "To date", kind: "date" },
        ]}
      />
      {handovers.length === 0 ? (
        <IllustratedEmpty
          title="No handovers yet. Open a facility and request one so coverage and open work are captured."
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
                <TH>Status</TH>
                <TH>Initiated by</TH>
                <TH>Snapshot</TH>
                <TH>Date</TH>
                {isAdmin ? <TH>Review</TH> : null}
              </TR>
            </THead>
            <TBody>
              {handovers.map((row) => (
                <TR key={row.id}>
                  <TD>{row.facility.name}</TD>
                  <TD>{row.fromUser?.name || "—"}</TD>
                  <TD>{row.toUser?.name || "—"}</TD>
                  <TD>{labelize(row.status)}</TD>
                  <TD>{row.initiatedBy.name}</TD>
                  <TD>
                    <HandoverSnapshot value={row.summarySnapshot} />
                  </TD>
                  <TD className="font-mono text-[12px]">{formatDate(row.createdAt)}</TD>
                  {isAdmin ? (
                    <TD>
                      {row.status === "PENDING" ? (
                        <HandoverReviewButtons handoverId={row.id} />
                      ) : (
                        row.reviewedBy?.name || "—"
                      )}
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
