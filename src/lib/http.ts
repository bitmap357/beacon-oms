/**
 * Shared API response helpers. Every route.ts should:
 *   const user = await requireApiUser();
 *   requireApiPermission(user, "…");
 *   catch { return errorResponse(error); }
 *
 * assertUnchanged implements optimistic concurrency via updatedAt.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { SessionUser } from "@/lib/permissions";
import { hasPermission, type Permission } from "@/lib/permissions";
import { loadFreshSessionUser, type FreshSessionUser } from "@/lib/fresh-session";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return json({ error: first?.message || "Invalid input" }, 400);
  }
  if (error instanceof Error && "status" in error) {
    const status = Number((error as { status?: number }).status) || 400;
    return json({ error: error.message }, status);
  }
  console.error(error);
  return json({ error: "Something went wrong" }, 500);
}

export async function requireApiUser(options?: {
  allowPasswordReset?: boolean;
}): Promise<FreshSessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, "Session expired. Sign in again.");
  }
  const fresh = await loadFreshSessionUser(session.user.id);
  if (!fresh) {
    throw new HttpError(401, "Session expired. Sign in again.");
  }
  if (fresh.mustResetPassword && !options?.allowPasswordReset) {
    throw new HttpError(403, "Password reset required.");
  }
  return fresh;
}

export function requireApiPermission(user: SessionUser, permission: Permission) {
  if (!hasPermission(user.role, permission)) {
    throw new HttpError(403, "Forbidden");
  }
}

export function parseUpdatedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Optimistic concurrency: updatedAt is required on PATCH bodies. */
export function assertUnchanged(current: Date, incoming?: string | null) {
  const parsed = parseUpdatedAt(incoming ?? null);
  if (!parsed) {
    throw new HttpError(400, "updatedAt is required. Refresh and try again.");
  }
  if (Math.abs(current.getTime() - parsed.getTime()) > 1000) {
    throw new HttpError(
      409,
      "This record was updated by someone else. Refresh and try again.",
    );
  }
}
