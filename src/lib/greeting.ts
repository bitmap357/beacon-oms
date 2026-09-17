/** Time-of-day greeting bands from the user's local clock hour (0–23). */
export function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
