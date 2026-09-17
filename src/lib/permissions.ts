/**
 * Who can do what, and which facilities they see.
 *
 * Edit ROLE_PERMISSIONS to grant/revoke a capability.
 *
 * Facility visibility (product decision): roles with facilities.readAll (including
 * DEVELOPER and PM_QA) see the org-wide facility list. Assignments drive staffing,
 * leads, and opt-in “My facilities” / ?scope=assigned filters — not a hard ACL wall
 * for those roles. Strip facilities.readAll only if product later wants assignment-scoped ACL.
 *
 * incidents.assign: required to change assigneeId on create/PATCH. DEVELOPER has
 * incidents.create (content/status) but not assign.
 *
 * Screens call assertPermission / getAccessibleFacilityIds; APIs use the same helpers via src/lib/http.ts.
 */
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
  | "audit.read";

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
    "audit.read",
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
  ],
  PM_QA: [
    "orgs.read",
    "facilities.readAll",
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
    "facilities.readAll",
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

/** Every facility the user may list. Roles with facilities.readAll see all sites. */
export async function getAccessibleFacilityIds(user: SessionUser) {
  if (hasPermission(user.role, "facilities.readAll")) {
    const rows = await prisma.facility.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  }

  return getAssignedFacilityIds(user);
}

/** Active FacilityAssignment rows for this user. */
export async function getAssignedFacilityIds(user: SessionUser) {
  const assignments = await prisma.facilityAssignment.findMany({
    where: { userId: user.id, isActive: true },
    select: { facilityId: true },
  });
  return [...new Set(assignments.map((row) => row.facilityId))];
}

/** List queries: scope=assigned uses assignments; otherwise all accessible facilities. */
export async function getScopedFacilityIds(
  user: SessionUser,
  scope?: string | null,
) {
  const all = await getAccessibleFacilityIds(user);
  if (scope !== "assigned") return all;
  const assigned = await getAssignedFacilityIds(user);
  return assigned.filter((id) => all.includes(id));
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
