/** PDF (Puppeteer), Word, Excel export of a ReportRecord. */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  type FileChild,
} from "docx";
import ExcelJS from "exceljs";
import {
  REPORT_SECTIONS,
  labelFor,
  formatReportValue,
  reportHtml,
  reportTitleFor,
  type ActionReportRow,
  type IncidentReportRow,
  type ReportRecord,
  type UnitEngagedRow,
} from "@/lib/reportTemplates";
import { ALLOWED_LOGO_MIME, dataUrlFrom, getObjectBuffer } from "@/lib/storage";
import { formatDate } from "@/lib/utils";

type LogoSource = { logoS3Key: string | null; logoFileType: string | null };

async function withLogos(
  report: ReportRecord,
  logos?: {
    facility?: LogoSource;
    organization?: LogoSource;
  },
) {
  if (!report.beaconLogoDataUrl) {
    try {
      const lockup = await readFile(path.join(process.cwd(), "public/brand/lockup.png"));
      report.beaconLogoDataUrl = dataUrlFrom(lockup, "image/png");
    } catch {
      // PDF still renders the text fallback in the masthead.
    }
  }
  if (
    !report.organizationLogoDataUrl &&
    logos?.organization?.logoS3Key &&
    logos.organization.logoFileType &&
    ALLOWED_LOGO_MIME.has(logos.organization.logoFileType)
  ) {
    try {
      const buffer = await getObjectBuffer(logos.organization.logoS3Key);
      report.organizationLogoDataUrl = dataUrlFrom(buffer, logos.organization.logoFileType);
    } catch {
      // Omit org logo slot.
    }
  }
  if (
    !report.facilityLogoDataUrl &&
    logos?.facility?.logoS3Key &&
    logos.facility.logoFileType &&
    ALLOWED_LOGO_MIME.has(logos.facility.logoFileType)
  ) {
    try {
      const buffer = await getObjectBuffer(logos.facility.logoS3Key);
      report.facilityLogoDataUrl = dataUrlFrom(buffer, logos.facility.logoFileType);
    } catch {
      // Fall back without facility logo.
    }
  }
  return report;
}

function chromeExecutable() {
  const fromEnv =
    process.env.CHROME_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.EDGE_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(
        `CHROME_PATH / PUPPETEER_EXECUTABLE_PATH points to a missing file: ${fromEnv}`,
      );
    }
    return fromEnv;
  }
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

export async function exportPdf(
  report: ReportRecord,
  logos?: {
    facility?: LogoSource;
    organization?: LogoSource;
  },
) {
  const payload = await withLogos(report, logos);
  const puppeteer = await import("puppeteer");
  const executablePath = chromeExecutable();
  if (!executablePath) {
    throw new Error(
      "PDF export needs Chrome or Edge. Install a browser, or set CHROME_PATH (or PUPPETEER_EXECUTABLE_PATH) to the executable.",
    );
  }
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(reportHtml(payload), { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="font-size:9px;width:100%;padding:0 14mm;color:#5B6472;font-family:Calibri,Arial,sans-serif;display:flex;justify-content:space-between;"><span>Beacon OMS</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
  } finally {
    await browser.close();
  }
}

function cell(text: string, header = false) {
  return new TableCell({
    width: { size: 2000, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D9DDE6" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DDE6" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "D9DDE6" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "D9DDE6" },
    },
    shading: header ? { fill: "0B3BA8" } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: header, color: header ? "FFFFFF" : "1C2430", size: 18 })],
      }),
    ],
  });
}

function simpleTable(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({ children: headers.map((header) => cell(header, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((value) => cell(value)) })),
    ],
  });
}

export async function exportDocx(report: ReportRecord) {
  const children: Paragraph[] = [
    new Paragraph({
      text: reportTitleFor(report.type),
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${report.facilityName} · ${report.organizationName} · ${formatDate(report.date)} · ${report.authorName}`,
          italics: true,
        }),
      ],
    }),
  ];
  for (const key of REPORT_SECTIONS[report.type]) {
    const value = report.content[key];
    const text = formatReportValue(value);
    if (text === "—") continue;
    children.push(
      new Paragraph({ text: labelFor(key), heading: HeadingLevel.HEADING_2 }),
      new Paragraph(text),
    );
  }
  const incidents = Array.isArray(report.content.incidentRows)
    ? (report.content.incidentRows as IncidentReportRow[])
    : [];
  const actions = Array.isArray(report.content.actionRows)
    ? (report.content.actionRows as ActionReportRow[])
    : [];
  const units = Array.isArray(report.content.unitsEngaged)
    ? (report.content.unitsEngaged as UnitEngagedRow[])
    : [];
  const docChildren = [...children];
  if (units.length) {
    docChildren.push(new Paragraph({ text: "Units engaged", heading: HeadingLevel.HEADING_2 }));
  }
  const sectionChildren: FileChild[] = [...docChildren];
  if (units.length) {
    sectionChildren.push(
      simpleTable(
        ["Unit", "Planned", "Actual"],
        units.map((row) => [String(row.name || "—"), row.planned ? "Yes" : "", row.actual ? "Yes" : ""]),
      ),
    );
  }
  if (incidents.length) {
    sectionChildren.push(
      new Paragraph({ text: "Issues identified / incidents", heading: HeadingLevel.HEADING_2 }),
      simpleTable(
        ["Unit", "Issue / incident", "Date reported", "Status", "Priority"],
        incidents.map((row) => [
          String(row.unit || "—"),
          String(row.issue || "—"),
          String(row.dateReported || "—"),
          String(row.status || "—"),
          String(row.priority || "—"),
        ]),
      ),
    );
  }
  if (actions.length) {
    sectionChildren.push(
      new Paragraph({ text: "Actions", heading: HeadingLevel.HEADING_2 }),
      simpleTable(
        ["Action", "Owner", "Due", "Status"],
        actions.map((row) => [
          String(row.title || "—"),
          String(row.owner || "—"),
          String(row.due || "—"),
          String(row.status || "—"),
        ]),
      ),
    );
  }
  const doc = new Document({ sections: [{ children: sectionChildren }] });
  return Packer.toBuffer(doc);
}

export async function exportXlsx(report: ReportRecord) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRow(["Field", "Value"]);
  sheet.addRow(["Facility", report.facilityName]);
  sheet.addRow(["Organization", report.organizationName]);
  sheet.addRow(["Date", report.date.toISOString()]);
  sheet.addRow(["Author", report.authorName]);
  for (const key of REPORT_SECTIONS[report.type]) {
    const value = report.content[key];
    sheet.addRow([
      labelFor(key),
      formatReportValue(value === "" ? null : value).replace("—", ""),
    ]);
  }
  const incidents = Array.isArray(report.content.incidentRows)
    ? (report.content.incidentRows as IncidentReportRow[])
    : [];
  if (incidents.length) {
    const incidentSheet = workbook.addWorksheet("Incidents");
    incidentSheet.addRow(["Unit", "Issue / incident", "Date reported", "Status", "Priority"]);
    for (const row of incidents) {
      incidentSheet.addRow([row.unit, row.issue, row.dateReported, row.status, row.priority]);
    }
  }
  const actions = Array.isArray(report.content.actionRows)
    ? (report.content.actionRows as ActionReportRow[])
    : [];
  if (actions.length) {
    const actionSheet = workbook.addWorksheet("Actions");
    actionSheet.addRow(["Action", "Owner", "Due", "Status"]);
    for (const row of actions) {
      actionSheet.addRow([row.title, row.owner, row.due, row.status]);
    }
  }
  return workbook.xlsx.writeBuffer();
}
