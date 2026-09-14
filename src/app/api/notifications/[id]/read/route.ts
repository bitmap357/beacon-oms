/** POST mark one notification read. */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const notification = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { isRead: true },
    });
    return json({ ok: notification.count > 0 });
  } catch (error) {
    return errorResponse(error);
  }
}
