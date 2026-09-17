import { describe, expect, it } from "vitest";

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Mirrors worker visit-due dedupe: skip if same type+relatedId within 24h. */
function shouldNotifyVisitDue(
  lastNotifiedAt: Date | null,
  now = new Date(),
) {
  if (!lastNotifiedAt) return true;
  return now.getTime() - lastNotifiedAt.getTime() >= DEDUPE_WINDOW_MS;
}

describe("VISIT_DUE dedupe window", () => {
  it("allows first notify and blocks within 24h", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    expect(shouldNotifyVisitDue(null, now)).toBe(true);
    expect(shouldNotifyVisitDue(new Date("2026-09-17T06:00:00Z"), now)).toBe(false);
    expect(shouldNotifyVisitDue(new Date("2026-09-16T11:59:00Z"), now)).toBe(true);
  });
});
