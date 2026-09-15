/** POST a comment on an incident. Anyone with facility access can comment. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { incidentCommentSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const incident = await prisma.incident.findUnique({ where: { id }, select: { facilityId: true } });
    if (!incident) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, incident.facilityId);
    const comments = await prisma.incidentComment.findMany({
      where: { incidentId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return json({ comments });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const incident = await prisma.incident.findUnique({ where: { id }, select: { facilityId: true } });
    if (!incident) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, incident.facilityId);
    const body = incidentCommentSchema.parse(await request.json());
    const meta = requestMeta(request);
    const comment = await prisma.$transaction(async (tx) => {
      const next = await tx.incidentComment.create({
        data: {
          incidentId: id,
          authorId: user.id,
          body: body.body,
        },
        include: { author: { select: { id: true, name: true } } },
      });
      await logAudit(tx, {
        userId: user.id,
        action: "incident.commented",
        entityType: "Incident",
        entityId: id,
        newValue: { commentId: next.id },
        ...meta,
      });
      return next;
    });
    return json({ comment }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
