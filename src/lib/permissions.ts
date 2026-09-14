/**
 * Who can do what, and which facilities they see.
 *
 * Edit ROLE_PERMISSIONS to grant/revoke a capability.
 * PM_QA / Developer only see facilities they are assigned to unless they have facilities.readAll.
 * Screens call assertPermission / getAccessibleFacilityIds; APIs use the same helpers via src/lib/http.ts.
 */
import type { Prisma } from "@prisma/client";
import type { UserRole } from "@/lib/db-types";
import { prisma } from "@/lib/db";

export type Permission =
  | "users.read"
  | "users.manage"
  | "users.forceReset"
  | "orgs.read"
  | "orgs.manage"
  | "facilities.readAll"
  | "facilities.manage"
  | "facilities.statusOverride"
  | "assignments.manage"
  | "incidents.create"
  | "incidents.assign"
  | "incidents.manage"
  | "activities.create"
  | "actions.manage"
  | "reports.manage"
  | "qa.manage"
  | "handovers.manage"
  | "analytics.view"
  | "analytics.full"
  | "audit.read"
  | "settings.manage";

/** Capability list per role. Add a Permission union member above before using it here. */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "users.read",
    "users.manage",
    "users.forceReset",
    "orgs.read",
    "orgs.manage",
    "facilities.readAll",
    "facilities.manage",
    "facilities.statusOverride",
    "assignments.manage",
    "incidents.create",
    "incidents.assign",
    "incidents.manage",
    "activities.create",
    "actions.manage",
    "reports.manage",
    "qa.manage",
    "handovers.manage",
    "analytics.view",
    "analytics.full",
    "audit.read",
    "settings.manage",
  ],
  MANAGEMENT: [
    "users.read",
    "orgs.read",
    "facilities.readAll",
    "facilities.manage",
    "facilities.statusOverride",
    "assignments.manage",
    "incidents.create",
    "incidents.assign",
    "incidents.manage",
    "activities.create",
    "actions.manage",
    "reports.manage",
    "qa.manage",
    "handovers.manage",
    "analytics.view",
    "analytics.full",
  ],
  PM_QA: [
    "orgs.read",
    "incidents.create",
    "incidents.assign",
    "incidents.manage",
    "activities.create",
    "actions.manage",
    "reports.manage",
    "qa.manage",
    "handovers.manage",
    "analytics.view",
    "facilities.statusOverride",
    "assignments.manage",
  ],
  DEVELOPER: [
    "orgs.read",
    "incidents.create",
    "activities.create",
    "actions.manage",
    "reports.manage",
    "analytics.view",
  ],
};

export type SessionUser = {
  id: string;
  role: UserRole;
  email: string;
  name: string;
};

export function hasPermission(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(user: SessionUser, permission: Permission) {
  if (!hasPermission(user.role, permission)) {
    const error = new Error("Forbidden") as Error & { status: number };
    error.status = 403;
    throw error;
  }
}

/** Admin/Management: every facility. Others: active FacilityAssignment rows only. */
export async function getAccessibleFacilityIds(user: SessionUser) {
  if (hasPermission(user.role, "facilities.readAll")) {
    const rows = await prisma.facility.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  }

  const assignments = await prisma.facilityAssignment.findMany({
    where: { userId: user.id, isActive: true },
    select: { facilityId: true },
  });
  return [...new Set(assignments.map((row) => row.facilityId))];
}

export function facilityScopeWhere(
  facilityIds: string[],
): Prisma.FacilityWhereInput {
  return { id: { in: facilityIds } };
}

export async function assertFacilityAccess(
  user: SessionUser,
  facilityId: string,
) {
  if (hasPermission(user.role, "facilities.readAll")) {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { id: true },
    });
    if (!facility) {
      const error = new Error("Facility not found") as Error & { status: number };
      error.status = 404;
      throw error;
    }
    return;
  }

  const assignment = await prisma.facilityAssignment.findFirst({
    where: { userId: user.id, facilityId, isActive: true },
    select: { id: true },
  });

  if (!assignment) {
    const error = new Error("Forbidden") as Error & { status: number };
    error.status = 403;
    throw error;
  }
}

export async function assertLeadOrElevated(
  user: SessionUser,
  facilityId: string,
) {
  if (user.role === "ADMIN" || user.role === "MANAGEMENT") return;
  const lead = await prisma.facilityAssignment.findFirst({
    where: {
      userId: user.id,
      facilityId,
      isActive: true,
      isLead: true,
      assignmentType: "PM_QA",
    },
  });
  if (!lead) {
    const error = new Error("Forbidden") as Error & { status: number };
    error.status = 403;
    throw error;
  }
}
