/** Admin approve/reject a pending handover. Approve transfers Lead PM/QA. */
import { prisma } from "@/lib/db";
import { logAudit, requestMeta } from "@/lib/audit";
import { HttpError, errorResponse, json, requireApiUser } from "@/lib/http";
import { handoverReviewSchema } from "@/lib/validation";
import { notifyUsers } from "@/lib/notifications";

async function transferLead(facilityId: string, fromUserId: string, toUserId: string) {
  await prisma.$transaction(async (tx) => {
    const leadRow = await tx.facilityAssignment.findFirst({
      where: {
        facilityId,
        userId: fromUserId,
        isActive: true,
        assignmentType: "PM_QA",
        isLead: true,
      },
    });
    if (leadRow) {
      await tx.facilityAssignment.update({
        where: { id: leadRow.id },
        data: { isLead: false },
      });
    }

    const activeForTo = await tx.facilityAssignment.findMany({
      where: { facilityId, userId: toUserId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    const primary = activeForTo[0];
    if (activeForTo.length > 1) {
      await tx.facilityAssignment.updateMany({
        where: { id: { in: activeForTo.slice(1).map((row) => row.id) } },
        data: { isActive: false, endDate: new Date(), isLead: false },
      });
    }
    if (primary) {
      await tx.facilityAssignment.update({
        where: { id: primary.id },
        data: { assignmentType: "PM_QA", isLead: true },
      });
    } else {
      const inactive = await tx.facilityAssignment.findFirst({
        where: { facilityId, userId: toUserId, isActive: false },
        orderBy: { updatedAt: "desc" },
      });
      if (inactive) {
        await tx.facilityAssignment.update({
          where: { id: inactive.id },
          data: {
            assignmentType: "PM_QA",
            isLead: true,
            isActive: true,
            startDate: new Date(),
            endDate: null,
          },
        });
      } else {
        await tx.facilityAssignment.create({
          data: {
            facilityId,
            userId: toUserId,
            assignmentType: "PM_QA",
            isLead: true,
          },
        });
      }
    }

    await tx.facilityAssignment.updateMany({
      where: {
        facilityId,
        assignmentType: "PM_QA",
        isLead: true,
        isActive: true,
        userId: { not: toUserId },
      },
      data: { isLead: false },
    });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can approve or reject handovers");
    }
    const { id } = await context.params;
    const body = handoverReviewSchema.parse(await request.json());
    const previous = await prisma.handover.findUnique({ where: { id } });
    if (!previous) return json({ error: "Not found" }, 404);
    if (previous.status !== "PENDING") {
      throw new HttpError(400, "This handover was already reviewed");
    }
    if (!previous.toUserId || !previous.fromUserId) {
      throw new HttpError(400, "Handover is missing from/to users");
    }

    const meta = requestMeta(request);
    if (body.decision === "APPROVED") {
      await transferLead(previous.facilityId, previous.fromUserId, previous.toUserId);
    }

    const handover = await prisma.handover.update({
      where: { id },
      data: {
        status: body.decision,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: body.note || null,
      },
    });

    await logAudit(prisma, {
      userId: user.id,
      action: body.decision === "APPROVED" ? "handover.approved" : "handover.rejected",
      entityType: "Handover",
      entityId: id,
      newValue: { status: body.decision, note: body.note },
      ...meta,
    });

    const recipients = [
      previous.toUserId,
      previous.fromUserId,
      previous.initiatedById,
    ].filter(Boolean) as string[];
    await notifyUsers(recipients, {
      type: body.decision === "APPROVED" ? "HANDOVER_APPROVED" : "HANDOVER_REJECTED",
      message:
        body.decision === "APPROVED"
          ? "Lead PM/QA handover approved — assignment transferred"
          : "Lead PM/QA handover rejected — assignments unchanged",
      relatedType: "Handover",
      relatedId: id,
    });

    return json({ handover });
  } catch (error) {
    return errorResponse(error);
  }
}
