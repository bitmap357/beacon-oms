import { describe, expect, it } from "vitest";
import { assignmentTypeFromRole } from "@/lib/assignment-type";

describe("assignmentTypeFromRole", () => {
  it("maps PM_QA and DEVELOPER", () => {
    expect(assignmentTypeFromRole("PM_QA")).toBe("PM_QA");
    expect(assignmentTypeFromRole("DEVELOPER")).toBe("DEVELOPER");
  });

  it("rejects management roles", () => {
    expect(() => assignmentTypeFromRole("ADMIN")).toThrow(/Only PM\/QA/);
    expect(() => assignmentTypeFromRole("MANAGEMENT")).toThrow(/Only PM\/QA/);
  });
});
