/** GET audit rows (admin). UI: /audit */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "audit.read");
    const url = new URL(request.url);
    const actor = url.searchParams.get("userId");
    const action = url.searchParams.get("action");
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const take = 50;

    const where = {
      ...(actor ? { userId: actor } : {}),
      ...(action ? { action: { contains: action } } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * take,
        take,
      }),
    ]);
    return json({ logs, total, page, take });
  } catch (error) {
    return errorResponse(error);
  }
}
