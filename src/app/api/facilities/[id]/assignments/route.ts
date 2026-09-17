/** POST PM/QA or developer assignment. Type is inferred from the person's role. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { assignmentSchema } from "@/lib/validation";
import { assignmentTypeFromRole } from "@/lib/assignment-type";

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

      // One active row per person per facility. Lead is a flag on that row.
      const activeRows = await tx.facilityAssignment.findMany({
        where: { facilityId: id, userId: body.userId, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      const primary = activeRows[0];
      if (activeRows.length > 1) {
        await tx.facilityAssignment.updateMany({
          where: {
            id: { in: activeRows.slice(1).map((row) => row.id) },
          },
          data: { isActive: false, endDate: new Date(), isLead: false },
        });
      }

      let next;
      let createdRow = false;
      if (primary) {
        next = await tx.facilityAssignment.update({
          where: { id: primary.id },
          data: { assignmentType, isLead },
        });
      } else {
        const inactive = await tx.facilityAssignment.findFirst({
          where: { facilityId: id, userId: body.userId, isActive: false },
          orderBy: { updatedAt: "desc" },
        });
        if (inactive) {
          next = await tx.facilityAssignment.update({
            where: { id: inactive.id },
            data: {
              assignmentType,
              isLead,
              isActive: true,
              startDate: new Date(),
              endDate: null,
            },
          });
        } else {
          next = await tx.facilityAssignment.create({
            data: {
              facilityId: id,
              userId: body.userId,
              assignmentType,
              isLead,
            },
          });
          createdRow = true;
        }
      }

      await logAudit(tx, {
        userId: user.id,
        action: createdRow
          ? isLead
            ? "assignment.lead_set"
            : "assignment.created"
          : isLead
            ? "assignment.lead_set"
            : "assignment.updated",
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
      return { assignment: next, created: createdRow };
    });
    return json({ assignment }, created ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
