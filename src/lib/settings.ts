/**
 * AppSetting key-value helpers. Facility health thresholds live under FACILITY_HEALTH_KEY.
 * Uses raw SQL when the Prisma client is mid-regenerate (appSetting delegate missing).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseJson, toJsonString } from "@/lib/db-types";

export const FACILITY_HEALTH_KEY = "facilityHealth";

/** Defaults match the historic hardcoded rules in facilityHealth.ts. */
export type FacilityHealthThresholds = {
  critical: { criticalOpenMin: number; unresolvedHighOver7DaysMin: number };
  atRisk: {
    openIncidentsMin: number;
    highPriorityOpenMin: number;
    overdueActionsMin: number;
    unresolvedHighOver7DaysMin: number;
  };
  attention: {
    openIncidentsMin: number;
    overdueActionsMin: number;
    /** Failed/retest QA older than 7 days counts when > 0 (threshold is presence). */
    oldPendingQAMin: number;
  };
};

export const DEFAULT_FACILITY_HEALTH: FacilityHealthThresholds = {
  critical: { criticalOpenMin: 1, unresolvedHighOver7DaysMin: 2 },
  atRisk: {
    openIncidentsMin: 3,
    highPriorityOpenMin: 2,
    overdueActionsMin: 3,
    unresolvedHighOver7DaysMin: 1,
  },
  attention: {
    openIncidentsMin: 1,
    overdueActionsMin: 1,
    oldPendingQAMin: 1,
  },
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function hasAppSetting(client: DbClient): client is DbClient & {
  appSetting: {
    findUnique: (args: { where: { key: string } }) => Promise<{ value: string } | null>;
    upsert: (args: {
      where: { key: string };
      create: { key: string; value: string; updatedById: string | null };
      update: { value: string; updatedById: string | null };
    }) => Promise<unknown>;
  };
} {
  return Boolean((client as { appSetting?: unknown }).appSetting);
}

export async function getSetting<T>(
  key: string,
  fallback: T,
  client: DbClient = prisma,
): Promise<T> {
  if (hasAppSetting(client)) {
    const row = await client.appSetting.findUnique({ where: { key } });
    if (!row) return fallback;
    return parseJson<T>(row.value, fallback);
  }
  const rows = await client.$queryRawUnsafe<{ value: string }[]>(
    `SELECT value FROM AppSetting WHERE [key] = N'${key.replaceAll("'", "''")}'`,
  );
  if (!rows[0]) return fallback;
  return parseJson<T>(rows[0].value, fallback);
}

export async function setSetting(
  key: string,
  value: unknown,
  updatedById?: string,
  client: DbClient = prisma,
) {
  const encoded = toJsonString(value);
  if (hasAppSetting(client)) {
    return client.appSetting.upsert({
      where: { key },
      create: { key, value: encoded, updatedById: updatedById ?? null },
      update: { value: encoded, updatedById: updatedById ?? null },
    });
  }
  const safeKey = key.replaceAll("'", "''");
  const safeValue = encoded.replaceAll("'", "''");
  const safeUser = updatedById ? `N'${updatedById.replaceAll("'", "''")}'` : "NULL";
  await client.$executeRawUnsafe(
    `MERGE AppSetting AS target
     USING (SELECT N'${safeKey}' AS [key]) AS source ON target.[key] = source.[key]
     WHEN MATCHED THEN UPDATE SET value = N'${safeValue}', updatedById = ${safeUser}, updatedAt = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN INSERT ([key], value, updatedById, updatedAt) VALUES (N'${safeKey}', N'${safeValue}', ${safeUser}, SYSUTCDATETIME());`,
  );
}

export async function getFacilityHealthThresholds(client: DbClient = prisma) {
  return getSetting(FACILITY_HEALTH_KEY, DEFAULT_FACILITY_HEALTH, client);
}
