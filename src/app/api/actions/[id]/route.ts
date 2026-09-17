/** PATCH action status/due date/owner. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { assertUnchanged, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { actionPatchSchema } from "@/lib/validation";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const action = await prisma.action.findUnique({
      where: { id },
      include: { facility: true, owner: true, incident: true },
    });
    if (!action) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, action.facilityId);
    return json({ action });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "actions.manage");
    const { id } = await context.params;
    const previous = await prisma.action.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const body = actionPatchSchema.parse(await request.json());
    assertUnchanged(previous.updatedAt, body.updatedAt);
    const completed =
      body.status === "COMPLETED" && previous.status !== "COMPLETED";
    const meta = requestMeta(request);
    const action = await prisma.$transaction(async (tx) => {
      const next = await tx.action.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          ownerId: body.ownerId,
          priority: body.priority,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          status: body.status,
          notes: body.notes,
          completedAt: completed ? new Date() : previous.completedAt,
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: completed ? "action.completed" : "action.updated",
        entityType: "Action",
        entityId: id,
        previousValue: { status: previous.status },
        newValue: { status: next.status },
        ...meta,
      });
      await refreshFacilityHealth(previous.facilityId, tx);
      return next;
    });
    return json({ action });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    requireApiPermission(user, "actions.manage");
    const { id } = await context.params;
    const previous = await prisma.action.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, previous.facilityId);
    const meta = requestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.action.delete({ where: { id } });
      await logAudit(tx, {
        userId: user.id,
        action: "action.deleted",
        entityType: "Action",
        entityId: id,
        previousValue: { title: previous.title, status: previous.status },
        ...meta,
      });
      await refreshFacilityHealth(previous.facilityId, tx);
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
