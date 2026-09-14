/** Wraps every signed-in page with AppShell. Unread badge comes from Notification.isRead. */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unread = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return (
    <AppShell user={user} unread={unread}>
      {children}
    </AppShell>
  );
}
