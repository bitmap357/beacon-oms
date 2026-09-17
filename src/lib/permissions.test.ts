import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("permissions", () => {
  it("grants incidents.assign to ADMIN and PM_QA but not DEVELOPER", () => {
    expect(hasPermission("ADMIN", "incidents.assign")).toBe(true);
    expect(hasPermission("PM_QA", "incidents.assign")).toBe(true);
    expect(hasPermission("DEVELOPER", "incidents.assign")).toBe(false);
  });

  it("keeps facilities.readAll for DEVELOPER (org-wide visibility)", () => {
    expect(hasPermission("DEVELOPER", "facilities.readAll")).toBe(true);
  });

  it("hides QA/handover manage from DEVELOPER", () => {
    expect(hasPermission("DEVELOPER", "qa.manage")).toBe(false);
    expect(hasPermission("DEVELOPER", "handovers.manage")).toBe(false);
  });
});
