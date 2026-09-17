/** GET ?format=pdf|docx|xlsx. Renderers: src/lib/reportTemplates/export.ts */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/permissions";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { exportDocx, exportPdf, exportXlsx } from "@/lib/reportTemplates/export";
import type { ReportRecord } from "@/lib/reportTemplates";
import { parseJson } from "@/lib/db-types";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const limited = await rateLimit(clientKey(request, "export"), 20, 60);
    if (!limited.ok) return json({ error: "Too many export requests" }, 429);
    const { id } = await context.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        facility: { include: { clientOrganization: true } },
        author: true,
      },
    });
    if (!report) return json({ error: "Not found" }, 404);
    await assertFacilityAccess(user, report.facilityId);
    const format = new URL(request.url).searchParams.get("format") || "pdf";
    const payload: ReportRecord = {
      type: report.type as ReportRecord["type"],
      facilityName: report.facility.name,
      organizationName: report.facility.clientOrganization.name,
      date: report.date,
      authorName: report.author.name,
      content: parseJson<Record<string, unknown>>(report.content, {}),
    };
    const logo = {
      logoS3Key: report.facility.logoS3Key,
      logoFileType: report.facility.logoFileType,
    };

    if (format === "docx") {
      const buffer = await exportDocx(payload);
      return new Response(Buffer.from(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${report.type.toLowerCase()}-report.docx"`,
        },
      });
    }
    if (format === "xlsx" || format === "csv") {
      const buffer = await exportXlsx(payload);
      return new Response(Buffer.from(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${report.type.toLowerCase()}-report.xlsx"`,
        },
      });
    }
    const pdf = await exportPdf(payload, logo);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.type.toLowerCase()}-report.pdf"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
