/** Redirect helper to /incidents?new=1 (form lives on the list page). */
import { redirect } from "next/navigation";

export default async function NewIncidentPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string }>;
}) {
  const { facilityId } = await searchParams;
  redirect(facilityId ? `/incidents?facilityId=${facilityId}` : "/incidents");
}
