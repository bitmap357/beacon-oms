/**
 * Cron-style jobs: refresh facility health, visit-due notices, overdue-action notices.
 * Run: npm run worker
 */
import { prisma } from "@/lib/db";
import { refreshFacilityHealth } from "@/lib/rules/facilityHealth";
import { calculateVisitRecommendation } from "@/lib/rules/visitRecommendation";
import { notifyUsers } from "@/lib/notifications";
import { OPEN_ACTION_STATUSES } from "@/lib/incident-status";

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function recentlyNotified(
  userId: string,
  type: string,
  relatedId: string,
) {
  return prisma.notification.findFirst({
    where: {
      userId,
      type,
      relatedId,
      createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    },
  });
}

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
      const recipients: string[] = [];
      for (const row of leads) {
        const already = await recentlyNotified(row.userId, "VISIT_DUE", facility.id);
        if (!already) recipients.push(row.userId);
      }
      if (recipients.length) {
        await notifyUsers(recipients, {
          type: "VISIT_DUE",
          message: `${facility.name}: ${visit.reason}`,
          relatedType: "Facility",
          relatedId: facility.id,
        });
      }
    }
  }

  const overdue = await prisma.action.findMany({
    where: {
      dueDate: { lt: new Date() },
      status: { in: [...OPEN_ACTION_STATUSES] },
    },
  });
  for (const action of overdue) {
    const already = await recentlyNotified(action.ownerId, "ACTION_OVERDUE", action.id);
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
      status: { in: [...OPEN_ACTION_STATUSES] },
    },
  });
  for (const action of dueSoon) {
    const already = await recentlyNotified(action.ownerId, "ACTION_DUE_SOON", action.id);
    if (!already) {
      await notifyUsers([action.ownerId], {
        type: "ACTION_DUE_SOON",
        message: `Action due soon: ${action.title}`,
        relatedType: "Action",
        relatedId: action.id,
      });
    }
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
