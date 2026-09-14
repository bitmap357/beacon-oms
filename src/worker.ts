/**
 * Cron-style jobs: refresh facility health, visit-due notices, overdue-action notices.
 * Run: npm run worker
 */
import { prisma } from "@/lib/db";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { notifyUsers } from "@/lib/notifications";

async function run() {
  const facilities = await prisma.facility.findMany({ select: { id: true, name: true } });
  for (const facility of facilities) {
    await refreshFacilityHealth(facility.id);
    const visit = await calculateVisitRecommendation(facility.id);
    if (visit.recommendation === "VISIT_DUE" || visit.recommendation === "URGENT_VISIT") {
      const leads = await prisma.facilityAssignment.findMany({
        where: { facilityId: facility.id, isActive: true, isLead: true },
        select: { userId: true },
      });
      await notifyUsers(
        leads.map((row) => row.userId),
        {
          type: "VISIT_DUE",
          message: `${facility.name}: ${visit.reason}`,
          relatedType: "Facility",
          relatedId: facility.id,
        },
      );
    }
  }

  const overdue = await prisma.action.findMany({
    where: {
      dueDate: { lt: new Date() },
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
    },
  });
  for (const action of overdue) {
    const already = await prisma.notification.findFirst({
      where: {
        userId: action.ownerId,
        type: "ACTION_OVERDUE",
        relatedId: action.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (!already) {
      await notifyUsers([action.ownerId], {
        type: "ACTION_OVERDUE",
        message: `Action overdue: ${action.title}`,
        relatedType: "Action",
        relatedId: action.id,
      });
    }
  }

  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dueSoon = await prisma.action.findMany({
    where: {
      dueDate: { gte: new Date(), lte: soon },
      status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
    },
  });
  for (const action of dueSoon) {
    await notifyUsers([action.ownerId], {
      type: "ACTION_DUE_SOON",
      message: `Action due soon: ${action.title}`,
      relatedType: "Action",
      relatedId: action.id,
    });
  }
}

async function loop() {
  console.log("Beacon worker started");
  for (;;) {
    try {
      await run();
    } catch (error) {
      console.error(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 15 * 60 * 1000));
  }
}

void loop();
