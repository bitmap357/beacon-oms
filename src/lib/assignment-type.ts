/** Infer FacilityAssignment.assignmentType from the user's role. */
import type { AssignmentType } from "@/lib/db-types";

export function assignmentTypeFromRole(role: string): AssignmentType {
  if (role === "DEVELOPER") return "DEVELOPER";
  if (role === "PM_QA") return "PM_QA";
  throw Object.assign(new Error("Only PM/QA and developers can be assigned to a facility"), {
    status: 400,
  });
}
