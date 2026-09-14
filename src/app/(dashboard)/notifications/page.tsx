/** In-app notification inbox. Mark read: /api/notifications/[id]/read */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { formatDateTime, labelize } from "@/lib/utils";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader title="Notifications" description="In-app alerts for assigned work, overdue items, and handovers." />
      <Card className="divide-y divide-hairline">
        {notifications.map((row) => (
          <div key={row.id} className="px-5 py-3">
            <p className="text-sm">{row.message}</p>
            <p className="text-[12px] text-slate">
              {labelize(row.type)} · {formatDateTime(row.createdAt)} · {row.isRead ? "Read" : "Unread"}
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}
