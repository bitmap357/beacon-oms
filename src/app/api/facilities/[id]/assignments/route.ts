/** POST PM/QA or developer assignment. Lead uniqueness is enforced here. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiPermission, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { assignmentSchema } from "@/lib/validation";

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
    if (body.isLead && (assignee.role !== "PM_QA" || body.assignmentType !== "PM_QA")) {
      throw new HttpError(400, "Lead must be an active PM/QA assignment");
    }
    const meta = requestMeta(request);
    const assignment = await prisma.$transaction(async (tx) => {
      if (body.isLead) {
        const existingLead = await tx.facilityAssignment.findFirst({
          where: { facilityId: id, isLead: true, isActive: true },
        });
        if (existingLead) {
          throw new HttpError(409, "This facility already has an active lead PM/QA");
        }
      }
      const next = await tx.facilityAssignment.create({
        data: {
          facilityId: id,
          userId: body.userId,
          assignmentType: body.assignmentType,
          isLead: Boolean(body.isLead),
        },
      });
      await logAudit(tx, {
        userId: user.id,
        action: body.isLead ? "assignment.lead_set" : "assignment.created",
        entityType: "FacilityAssignment",
        entityId: next.id,
        newValue: {
          facilityId: id,
          userId: body.userId,
          assignmentType: body.assignmentType,
          isLead: Boolean(body.isLead),
        },
        ...meta,
      });
      return next;
    });
    return json({ assignment }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
