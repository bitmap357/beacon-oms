/**
 * Date/label helpers. formatRole maps PM_QA → "PM/QA" (header, users table, assignments).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function incidentLabel(row: { createdAt?: Date | string | null }) {
  const date = formatDate(row.createdAt);
  return date === "—" ? "Incident" : `Incident · ${date}`;
}

export function incidentRecordFields(input?: {
  title?: string | null;
  description?: string | null;
}) {
  return {
    title: input?.title?.trim() || "Incident",
    description: input?.description?.trim() || "",
  };
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function labelize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function formatRole(value: string) {
  const labels: Record<string, string> = {
    PM_QA: "PM/QA",
    DEVELOPER: "Developer",
    MANAGEMENT: "Management",
    ADMIN: "Admin",
  };
  return labels[value] ?? labelize(value);
}

export function daysBetween(from: Date, to = new Date()) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
