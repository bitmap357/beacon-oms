/**
 * Report field lists per type, HTML preview, and value formatting.
 * Export PDF/Word/Excel: ./export.ts
 * On-screen report: src/app/(dashboard)/reports/[id]/page.tsx
 *
 * Print layout follows a professional site-visit template: masthead logos,
 * centred title, meta table, numbered sections, incident/action tables,
 * navy header row + gold section rules. Decorative gradients are not used.
 */
import { formatDate } from "@/lib/utils";

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
    "purpose",
    "period",
    "scope",
    "summary",
    "observations",
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
    "nextSteps",
    "conclusion",
    "contact",
  ],
} as const;

const STRUCTURED_KEYS = new Set([
  "incidentRows",
  "actionRows",
  "summaryMeta",
  "unitsEngaged",
]);

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
  beaconLogoDataUrl?: string;
  facilityLogoDataUrl?: string;
};

export type IncidentReportRow = {
  unit?: string;
  issue?: string;
  dateReported?: string;
  status?: string;
  priority?: string;
};

export type ActionReportRow = {
  title?: string;
  owner?: string;
  due?: string;
  status?: string;
};

export type UnitEngagedRow = {
  name?: string;
  planned?: boolean | string;
  actual?: boolean | string;
};

export function reportTitleFor(type: ReportRecord["type"] | string) {
  if (type === "SITE_VISIT" || type === "OPERATIONAL") return "SITE VISIT REPORT";
  if (type === "INCIDENT") return "INCIDENT REPORT";
  if (type === "QA") return "QA VERIFICATION REPORT";
  if (type === "TRAINING") return "TRAINING REPORT";
  if (type === "DEPLOYMENT") return "DEPLOYMENT REPORT";
  return `${String(type).replaceAll("_", " ")} REPORT`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRows<T extends Record<string, unknown>>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is T => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

function checkMark(value: unknown) {
  return value === true || value === "true" || value === "✓" ? "✓" : "";
}

export function reportHtml(report: ReportRecord) {
  const content = report.content || {};
  const meta = asRecord(content.summaryMeta);
  const units = asRows<UnitEngagedRow>(content.unitsEngaged);
  const incidents = asRows<IncidentReportRow>(content.incidentRows);
  const actions = asRows<ActionReportRow>(content.actionRows);
  const purpose =
    formatReportValue(content.purpose || content.visitPurpose) === "—"
      ? null
      : formatReportValue(content.purpose || content.visitPurpose);

  const toc: string[] = [];
  const body: string[] = [];
  let section = 0;

  function addSection(title: string, html: string) {
    section += 1;
    const label = `${section}.0 ${title}`;
    toc.push(`<li>${escapeHtml(label)}</li>`);
    body.push(`<h2>${escapeHtml(label)}</h2>${html}`);
  }

  if (purpose) {
    addSection("Purpose of visit", `<p>${escapeHtml(purpose)}</p>`);
  }

  if (meta) {
    const rows = Object.entries(meta)
      .filter(([, value]) => formatReportValue(value) !== "—")
      .map(
        ([key, value]) =>
          `<tr><th>${escapeHtml(labelFor(key))}</th><td>${escapeHtml(formatReportValue(value))}</td></tr>`,
      )
      .join("");
    if (rows) addSection("Summary of visit", `<table class="meta">${rows}</table>`);
  }

  if (units.length) {
    const rows = units
      .map(
        (row, index) =>
          `<tr><td>${index + 1}</td><td>${escapeHtml(String(row.name || "—"))}</td><td>${escapeHtml(checkMark(row.planned) || "✓")}</td><td>${escapeHtml(checkMark(row.actual) || "")}</td></tr>`,
      )
      .join("");
    addSection(
      "Units engaged",
      `<table class="data"><thead><tr><th>#</th><th>Unit</th><th>Planned</th><th>Actual</th></tr></thead><tbody>${rows}</tbody></table>`,
    );
  }

  const skipGeneric = new Set<string>([
    ...STRUCTURED_KEYS,
    "purpose",
    "visitPurpose",
  ]);
  if (meta) skipGeneric.add("scope");
  if (incidents.length) {
    skipGeneric.add("keyIncidents");
    skipGeneric.add("incidentCount");
    skipGeneric.add("openIncidents");
    skipGeneric.add("closedIncidents");
    skipGeneric.add("incidentsByPriority");
    skipGeneric.add("incidentsByFacility");
  }
  if (actions.length) {
    skipGeneric.add("outstandingActions");
    skipGeneric.add("actionCount");
    skipGeneric.add("overdueActions");
    skipGeneric.add("completedActions");
  }

  for (const key of REPORT_SECTIONS[report.type]) {
    if (skipGeneric.has(key)) continue;
    const text = formatReportValue(content[key]);
    if (text === "—") continue;
    addSection(labelFor(key), `<p>${escapeHtml(text)}</p>`);
  }

  if (incidents.length) {
    const rows = incidents
      .map(
        (row) =>
          `<tr><td>${escapeHtml(String(row.unit || "—"))}</td><td>${escapeHtml(String(row.issue || "—"))}</td><td>${escapeHtml(String(row.dateReported || "—"))}</td><td>${escapeHtml(String(row.status || "—"))}</td><td>${escapeHtml(String(row.priority || "—"))}</td></tr>`,
      )
      .join("");
    addSection(
      "Issues identified / incidents",
      `<table class="data"><thead><tr><th>Unit</th><th>Issue / incident</th><th>Date reported</th><th>Status</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table>`,
    );
  }

  if (actions.length) {
    const rows = actions
      .map(
        (row) =>
          `<tr><td>${escapeHtml(String(row.title || "—"))}</td><td>${escapeHtml(String(row.owner || "—"))}</td><td>${escapeHtml(String(row.due || "—"))}</td><td>${escapeHtml(String(row.status || "—"))}</td></tr>`,
      )
      .join("");
    addSection(
      "Actions",
      `<table class="data"><thead><tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`,
    );
  }

  const beacon = report.beaconLogoDataUrl
    ? `<img class="logo" src="${escapeHtml(report.beaconLogoDataUrl)}" alt="Beacon" />`
    : `<div class="logo-fallback">Beacon</div>`;
  const facility = report.facilityLogoDataUrl
    ? `<img class="logo" src="${escapeHtml(report.facilityLogoDataUrl)}" alt="${escapeHtml(report.facilityName)}" />`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #1C2430; font-size: 11pt; line-height: 1.45; margin: 0; }
    .masthead { display: flex; justify-content: space-between; align-items: center; gap: 24px; border-bottom: 3px solid #0B3BA8; padding-bottom: 12px; margin-bottom: 18px; }
    .logo, .logo-fallback { max-height: 56px; max-width: 180px; object-fit: contain; }
    .logo-fallback { font-family: Cambria, Georgia, serif; font-size: 18pt; color: #0B3BA8; font-weight: 700; }
    .kicker { color: #5B6472; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 6px; text-align: center; }
    h1 { font-family: Cambria, Georgia, serif; font-size: 22pt; color: #0B3BA8; letter-spacing: 0.06em; text-align: center; margin: 0 0 8px; }
    .lede { text-align: center; color: #5B6472; font-size: 10pt; margin: 0 0 18px; }
    .toc { margin: 0 0 22px; padding: 10px 14px; border: 1px solid #E6DFD0; background: #FFFDF8; }
    .toc h2 { margin-top: 0; }
    .toc ol { margin: 0; padding-left: 0; list-style: none; }
    h2 { font-family: Cambria, Georgia, serif; font-size: 13pt; color: #0B3BA8; border-bottom: 1.5px solid #E8B923; padding-bottom: 4px; margin: 22px 0 10px; }
    p { margin: 0 0 10px; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    table.meta th, table.meta td { border: 1px solid #D9DDE6; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 10pt; }
    table.meta th { width: 28%; background: #EEF3FB; color: #0B3BA8; font-weight: 600; }
    table.data th { background: #0B3BA8; color: #fff; padding: 7px 8px; text-align: left; font-size: 9.5pt; font-weight: 600; }
    table.data td { border: 1px solid #D9DDE6; padding: 6px 8px; vertical-align: top; font-size: 9.5pt; }
    table.data tbody tr:nth-child(even) td { background: #F7F5EF; }
  </style></head><body>
  <header class="masthead">${beacon}${facility}</header>
  <p class="kicker">Beacon operations management system</p>
  <h1>${escapeHtml(reportTitleFor(report.type))}</h1>
  <p class="lede">${escapeHtml(report.facilityName)} · ${escapeHtml(report.organizationName)}<br/>Report date ${escapeHtml(formatDate(report.date))} · Prepared by ${escapeHtml(report.authorName)}</p>
  ${toc.length ? `<nav class="toc"><h2>Table of contents</h2><ol>${toc.join("")}</ol></nav>` : ""}
  ${body.join("")}
  </body></html>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
