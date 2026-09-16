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

export async function requireApiUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, "Unauthorized");
  }
  return session.user as SessionUser;
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

export function assertUnchanged(current: Date, incoming?: string | null) {
  const parsed = parseUpdatedAt(incoming ?? null);
  if (!parsed) return;
  if (Math.abs(current.getTime() - parsed.getTime()) > 1000) {
    throw new HttpError(
      409,
      "This record was updated by someone else. Refresh and try again.",
    );
  }
}
