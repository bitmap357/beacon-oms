/** POST PM/QA or developer assignment. Type is inferred from the person's role. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { assignmentSchema } from "@/lib/validation";

function assignmentTypeFromRole(role: string) {
  if (role === "DEVELOPER") return "DEVELOPER" as const;
  if (role === "PM_QA") return "PM_QA" as const;
  throw new HttpError(400, "Only PM/QA and developers can be assigned to a facility");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const assignments = await prisma.facilityAssignment.findMany({
      where: { facilityId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { startDate: "desc" },
    });
    return json({ assignments });
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
    requireApiPermission(user, "assignments.manage");
    const { id } = await context.params;
    await assertFacilityAccess(user, id);
    const body = assignmentSchema.parse(await request.json());
    const assignee = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!assignee || !assignee.isActive) throw new HttpError(400, "User not found");
    const assignmentType = assignmentTypeFromRole(assignee.role);
    const isLead = Boolean(body.isLead);
    const meta = requestMeta(request);
    const { assignment, created } = await prisma.$transaction(async (tx) => {
      if (isLead) {
        await tx.facilityAssignment.updateMany({
          where: {
            facilityId: id,
            assignmentType,
            isLead: true,
            isActive: true,
            userId: { not: body.userId },
          },
          data: { isLead: false },
        });
      }
      const existing = await tx.facilityAssignment.findFirst({
        where: { facilityId: id, userId: body.userId, isActive: true },
      });
      const next = existing
        ? await tx.facilityAssignment.update({
            where: { id: existing.id },
            data: { assignmentType, isLead },
          })
        : await tx.facilityAssignment.create({
            data: {
              facilityId: id,
              userId: body.userId,
              assignmentType,
              isLead,
            },
          });
      await logAudit(tx, {
        userId: user.id,
        action: existing
          ? isLead
            ? "assignment.lead_set"
            : "assignment.updated"
          : isLead
            ? "assignment.lead_set"
            : "assignment.created",
        entityType: "FacilityAssignment",
        entityId: next.id,
        newValue: {
          facilityId: id,
          userId: body.userId,
          assignmentType,
          isLead,
        },
        ...meta,
      });
      return { assignment: next, created: !existing };
    });
    return json({ assignment }, created ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
