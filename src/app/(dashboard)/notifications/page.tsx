/** In-app notification inbox. Mark read: /api/notifications/[id]/read */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { formatDateTime, labelize } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton } from "@/components/notification-actions";
import { IllustratedEmpty } from "@/components/empty-state";
import { ListFilters } from "@/components/list-filters";
import { dateRange } from "@/lib/incident-status";

const NOTIFICATION_TYPES = [
  "INCIDENT_ASSIGNED",
  "INCIDENT_STATUS_CHANGED",
  "INCIDENT_REOPENED",
  "ACTION_ASSIGNED",
  "ACTION_DUE_SOON",
  "ACTION_OVERDUE",
  "VISIT_DUE",
  "QA_VERIFICATION_REQUIRED",
  "HANDOVER_INITIATED",
  "HANDOVER_COMPLETED",
  "REPORT_NEEDS_REVIEW",
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; unread?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const { type, unread, from, to } = await searchParams;
  const range = dateRange(from, to);
  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(type ? { type } : {}),
      ...(unread === "1" ? { isRead: false } : {}),
      ...(range ? { createdAt: range } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const unreadIds = notifications.filter((row) => !row.isRead).map((row) => row.id);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="In-app alerts for assigned work, overdue items, and handovers."
        illustration="/brand/illustrations/page-notifications.png"
        actions={<MarkAllReadButton ids={unreadIds} />}
      />
      <ListFilters
        exportPath="/api/export/notifications"
        fields={[
          {
            name: "type",
            label: "Type",
            kind: "select",
            options: NOTIFICATION_TYPES.map((value) => ({ value, label: labelize(value) })),
          },
          { name: "from", label: "From", kind: "date" },
          { name: "to", label: "To", kind: "date" },
          { name: "unread", label: "Unread only", kind: "checkbox" },
        ]}
      />
      {notifications.length === 0 ? (
        <IllustratedEmpty
          title="You're all caught up. Alerts for visits, actions, and handovers will land here."
          image="/brand/illustrations/page-notifications.png"
        />
      ) : (
        <Card className="divide-y divide-hairline">
          {notifications.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-[15px]">{row.message}</p>
                <p className="text-[12px] text-slate">
                  {labelize(row.type)} · {formatDateTime(row.createdAt)} · {row.isRead ? "Read" : "Unread"}
                </p>
              </div>
              <MarkReadButton id={row.id} isRead={row.isRead} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
