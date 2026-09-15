/** In-app notification inbox. Mark read: /api/notifications/[id]/read */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { formatDateTime, labelize } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton } from "@/components/notification-actions";
import { IllustratedEmpty } from "@/components/empty-state";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
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
