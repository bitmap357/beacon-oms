/** PDF (Puppeteer), Word, Excel export of a ReportRecord. */
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import ExcelJS from "exceljs";
import { REPORT_SECTIONS, labelFor, formatReportValue, reportHtml, type ReportRecord } from "@/lib/reportTemplates";

export async function exportPdf(report: ReportRecord) {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(reportHtml(report), { waitUntil: "load" });
    return await page.pdf({ format: "A4", printBackground: true, margin: { top: "20mm", bottom: "20mm", left: "16mm", right: "16mm" } });
  } finally {
    await browser.close();
  }
}

export async function exportDocx(report: ReportRecord) {
  const children: Paragraph[] = [
    new Paragraph({
      text: `${report.type.replaceAll("_", " ")} report`,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${report.facilityName} · ${report.organizationName} · ${report.date.toDateString()} · ${report.authorName}`,
          italics: true,
        }),
      ],
    }),
  ];
  for (const key of REPORT_SECTIONS[report.type]) {
    const value = report.content[key];
    const text = formatReportValue(value);
    children.push(
      new Paragraph({ text: labelFor(key), heading: HeadingLevel.HEADING_2 }),
      new Paragraph(text),
    );
  }
  const doc = new Document({ sections: [{ children }] });
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
  return workbook.xlsx.writeBuffer();
}
