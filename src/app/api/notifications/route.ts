/** GET current user's notifications. */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireApiUser();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return json({ notifications });
  } catch (error) {
    return errorResponse(error);
  }
}
