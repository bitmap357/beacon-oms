/** GET ?q= search across facilities, incidents, users. */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { getAccessibleFacilityIds } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (q.length < 2) return json({ results: [] });
    const ids = await getAccessibleFacilityIds(user);
    const [facilities, users, incidents, activities, actions, reports] =
      await Promise.all([
        prisma.facility.findMany({
          where: { id: { in: ids }, name: { contains: q } },
          select: { id: true, name: true, status: true },
          take: 8,
        }),
        prisma.user.findMany({
          where: {
            OR: [{ name: { contains: q } }, { email: { contains: q } }],
          },
          select: { id: true, name: true, role: true },
          take: 8,
        }),
        prisma.incident.findMany({
          where: { facilityId: { in: ids }, title: { contains: q } },
          select: { id: true, title: true, status: true },
          take: 8,
        }),
        prisma.activity.findMany({
          where: { facilityId: { in: ids }, description: { contains: q } },
          select: { id: true, type: true, description: true },
          take: 8,
        }),
        prisma.action.findMany({
          where: { facilityId: { in: ids }, title: { contains: q } },
          select: { id: true, title: true, status: true },
          take: 8,
        }),
        prisma.report.findMany({
          where: { facilityId: { in: ids } },
          select: { id: true, type: true, status: true },
          take: 8,
        }),
      ]);

    return json({
      results: [
        ...facilities.map((row) => ({ kind: "facility", ...row })),
        ...users.map((row) => ({ kind: "user", ...row })),
        ...incidents.map((row) => ({ kind: "incident", ...row })),
        ...activities.map((row) => ({ kind: "activity", ...row })),
        ...actions.map((row) => ({ kind: "action", ...row })),
        ...reports.map((row) => ({ kind: "report", ...row })),
      ],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
