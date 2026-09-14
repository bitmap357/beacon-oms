/**
 * Writes a Notification row and optionally emails. Types are in src/lib/db-types.ts (NotificationType).
 */
import type { Prisma } from "@prisma/client";
import type { NotificationType } from "@/lib/db-types";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function notifyUsers(
  userIds: string[],
  input: {
    type: NotificationType;
    message: string;
    relatedType?: string;
    relatedId?: string;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return [];

  const created = await Promise.all(
    unique.map((userId) =>
      client.notification.create({
        data: {
          userId,
          type: input.type,
          message: input.message,
          relatedType: input.relatedType,
          relatedId: input.relatedId,
        },
      }),
    ),
  );

  queueMicrotask(() => {
    void sendNotificationEmails(created.map((row) => row.id));
  });

  return created;
}

async function sendNotificationEmails(ids: string[]) {
  const rows = await prisma.notification.findMany({
    where: { id: { in: ids } },
    include: { user: { select: { email: true, name: true } } },
  });
  for (const row of rows) {
    const ok = await sendEmail(
      row.user.email,
      `Beacon: ${row.type.replaceAll("_", " ").toLowerCase()}`,
      `<p>Hello ${row.user.name},</p><p>${row.message}</p><p>Open Beacon to review this item.</p>`,
    );
    if (ok) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { emailSent: true },
      });
    }
  }
}
