/** Shared start/end time ordering check for activities, visits, and Zod schemas. */
export function endAfterStart(
  startTime?: string | Date | null,
  endTime?: string | Date | null,
): boolean {
  if (startTime == null || endTime == null || startTime === "" || endTime === "") {
    return true;
  }
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
  return end.getTime() > start.getTime();
}

export function endAfterStartMessage() {
  return "End time must be after start time";
}
