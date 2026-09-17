/** GET current user's notifications. Optional ?limit= (1–50, default 50). */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const raw = Number(searchParams.get("limit") || 50);
    const take = Number.isFinite(raw) ? Math.min(50, Math.max(1, Math.floor(raw))) : 50;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);
    return json({ notifications, unreadCount });
  } catch (error) {
    return errorResponse(error);
  }
}
