/**
 * Append-only audit trail. Call inside the same prisma.$transaction as the mutation.
 * Objects are JSON-stringified because AuditLog.previousValue/newValue are NVARCHAR.
 * UI: src/app/(dashboard)/audit/page.tsx
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toJsonString } from "@/lib/db-types";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAudit(
  tx: Prisma.TransactionClient | typeof prisma,
  input: AuditInput,
) {
  return tx.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousValue:
        input.previousValue == null ? null : toJsonString(input.previousValue),
      newValue: input.newValue == null ? null : toJsonString(input.newValue),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export function requestMeta(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}
