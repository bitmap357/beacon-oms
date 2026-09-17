/**
 * Human-visible incident IDs: INC-YYYY-NNNNN (global yearly sequence).
 * Allocated on create; backfillExistingIncidentNumbers covers seed/legacy rows.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function formatIncidentNumber(year: number, seq: number) {
  return `INC-${year}-${String(seq).padStart(5, "0")}`;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

function hasCounter(client: DbClient) {
  return Boolean((client as { incidentNumberCounter?: unknown }).incidentNumberCounter);
}

export async function allocateIncidentNumber(
  client: DbClient = prisma,
  at: Date = new Date(),
) {
  const year = at.getUTCFullYear();
  if (hasCounter(client)) {
    const counter = (
      client as typeof prisma
    ).incidentNumberCounter;
    const existing = await counter.findUnique({ where: { year } });
    if (!existing) {
      await counter.create({ data: { year, lastValue: 1 } });
      return formatIncidentNumber(year, 1);
    }
    const next = await counter.update({
      where: { year },
      data: { lastValue: { increment: 1 } },
    });
    return formatIncidentNumber(year, next.lastValue);
  }

  await client.$executeRawUnsafe(
    `IF NOT EXISTS (SELECT 1 FROM IncidentNumberCounter WHERE [year] = ${year})
     INSERT INTO IncidentNumberCounter ([year], lastValue) VALUES (${year}, 0);`,
  );
  const rows = await client.$queryRawUnsafe<{ lastValue: number }[]>(
    `UPDATE IncidentNumberCounter SET lastValue = lastValue + 1 OUTPUT INSERTED.lastValue WHERE [year] = ${year}`,
  );
  const seq = rows[0]?.lastValue ?? 1;
  return formatIncidentNumber(year, seq);
}

/** One-shot backfill for rows created before incidentNumber existed. */
export async function backfillExistingIncidentNumbers() {
  const missing = await prisma.incident.findMany({
    where: { OR: [{ incidentNumber: null }, { incidentNumber: "" }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, reportedAt: true },
  });
  for (const row of missing) {
    const at = row.reportedAt || row.createdAt;
    await prisma.$transaction(async (tx) => {
      const number = await allocateIncidentNumber(tx, at);
      await tx.incident.update({
        where: { id: row.id },
        data: { incidentNumber: number },
      });
    });
  }
  return missing.length;
}
