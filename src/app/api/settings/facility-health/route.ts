/** GET/PUT facility health threshold settings (admin). */
import { prisma } from "@/lib/db";
import { errorResponse, json, requireApiUser, HttpError } from "@/lib/http";
import { logAudit, requestMeta } from "@/lib/audit";
import {
  DEFAULT_FACILITY_HEALTH,
  FACILITY_HEALTH_KEY,
  getFacilityHealthThresholds,
  setSetting,
} from "@/lib/settings";
import { facilityHealthSettingsSchema } from "@/lib/validation";
import { describeFacilityHealthCriteria } from "@/lib/rules/facilityHealth";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user.role !== "ADMIN" && user.role !== "MANAGEMENT") {
      throw new HttpError(403, "Forbidden");
    }
    const thresholds = await getFacilityHealthThresholds();
    return json({
      thresholds,
      defaults: DEFAULT_FACILITY_HEALTH,
      criteria: describeFacilityHealthCriteria(thresholds),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can update health thresholds");
    }
    const body = facilityHealthSettingsSchema.parse(await request.json());
    const meta = requestMeta(request);
    await setSetting(FACILITY_HEALTH_KEY, body, user.id);
    await logAudit(prisma, {
      userId: user.id,
      action: "settings.facility_health_updated",
      entityType: "AppSetting",
      entityId: FACILITY_HEALTH_KEY,
      newValue: body,
      ...meta,
    });
    return json({
      thresholds: body,
      criteria: describeFacilityHealthCriteria(body),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
