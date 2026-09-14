/**
 * Report field lists per type, HTML preview, and value formatting.
 * Export PDF/Word/Excel: ./export.ts
 * On-screen report: src/app/(dashboard)/reports/[id]/page.tsx
 */
export const REPORT_SECTIONS = {
  SITE_VISIT: [
    "visitPurpose",
    "teamMembers",
    "activitiesPerformed",
    "systemsReviewed",
    "findings",
    "issuesIdentified",
    "incidentsCreated",
    "actionsCreated",
    "recommendations",
    "followUpDate",
    "additionalNotes",
  ],
  INCIDENT: [
    "impact",
    "actionsTaken",
    "currentStatus",
    "resolution",
    "qaVerification",
    "closureDate",
  ],
  QA: [
    "itemsTested",
    "testResults",
    "findings",
    "result",
    "requiredCorrections",
    "retestDate",
    "finalVerification",
  ],
  TRAINING: [
    "trainer",
    "participants",
    "trainingTopic",
    "modulesCovered",
    "issuesRaised",
    "participantObservations",
    "followUpActions",
    "recommendations",
  ],
  DEPLOYMENT: [
    "deploymentTeam",
    "systemModule",
    "versionRelease",
    "deploymentActivities",
    "configurationChanges",
    "issuesEncountered",
    "qaResult",
    "outstandingActions",
    "signOff",
  ],
  OPERATIONAL: [
    "period",
    "scope",
    "summary",
    "incidentCount",
    "openIncidents",
    "closedIncidents",
    "actionCount",
    "overdueActions",
    "completedActions",
    "incidentsByPriority",
    "incidentsByFacility",
    "keyIncidents",
    "outstandingActions",
    "recommendations",
  ],
} as const;

export function labelFor(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function formatReportValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => formatReportValue(item)).join("\n");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export type ReportRecord = {
  type: keyof typeof REPORT_SECTIONS;
  facilityName: string;
  organizationName: string;
  date: Date;
  authorName: string;
  content: Record<string, unknown>;
};

export function reportHtml(report: ReportRecord) {
  const sections = REPORT_SECTIONS[report.type]
    .map((key) => {
      const value = report.content[key];
      const text = formatReportValue(value);
      return `<section><h2>${labelFor(key)}</h2><p>${escapeHtml(text)}</p></section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #1C2430; font-size: 13px; }
    h1 { font-family: "Space Grotesk", sans-serif; font-size: 22px; }
    h2 { font-family: "Space Grotesk", sans-serif; font-size: 16px; margin-bottom: 6px; }
    header { border-bottom: 1px solid #E3E1D9; padding-bottom: 12px; margin-bottom: 20px; }
    .meta { color: #5B6472; font-size: 12px; }
  </style></head><body>
  <header>
    <div class="meta">Beacon operations management system</div>
    <h1>${escapeHtml(report.type.replaceAll("_", " "))} report</h1>
    <p class="meta">${escapeHtml(report.facilityName)} · ${escapeHtml(report.organizationName)} · ${report.date.toDateString()} · ${escapeHtml(report.authorName)}</p>
  </header>
  ${sections}
  </body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
