/** Header search results for facilities, incidents, people. */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getScopedFacilityIds } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { incidentLabel, labelize } from "@/lib/utils";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const query = q.trim();
  const ids = await getScopedFacilityIds(user);
  const results =
    query.length < 2
      ? { facilities: [], users: [], incidents: [], activities: [], actions: [], reports: [] }
      : {
          facilities: await prisma.facility.findMany({
            where: { id: { in: ids }, name: { contains: query } },
            take: 8,
          }),
          users: await prisma.user.findMany({
            where: { OR: [{ name: { contains: query } }, { email: { contains: query } }] },
            take: 8,
          }),
          incidents: await prisma.incident.findMany({
            where: {
              facilityId: { in: ids },
              OR: [
                { facility: { name: { contains: query } } },
                { status: { contains: query } },
                { priority: { contains: query } },
              ],
            },
            take: 8,
          }),
          activities: await prisma.activity.findMany({
            where: { facilityId: { in: ids }, description: { contains: query } },
            take: 8,
          }),
          actions: await prisma.action.findMany({
            where: { facilityId: { in: ids }, title: { contains: query } },
            take: 8,
          }),
          reports: await prisma.report.findMany({
            where: { facilityId: { in: ids } },
            take: 8,
          }),
        };

  return (
    <div>
      <PageHeader title="Search" description="Facilities, people, incidents, activities, actions, and reports." />
      <form className="mb-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search"
          className="h-9 w-full max-w-lg rounded-[10px] border border-hairline px-3"
        />
      </form>
      {query.length < 2 ? (
        <p className="text-sm text-slate">Enter at least two characters.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(results).map(([kind, rows]) => (
            <Card key={kind} className="p-5">
              <h2 className="font-heading mb-2 text-[18px]">{labelize(kind)}</h2>
              <ul className="space-y-1 text-sm">
                {rows.map((row) => {
                  const href =
                    kind === "facilities"
                      ? `/facilities/${row.id}`
                      : kind === "users"
                        ? `/profile/${row.id}`
                        : kind === "incidents"
                          ? `/incidents/${row.id}`
                          : kind === "actions"
                            ? "/actions"
                            : kind === "reports"
                              ? "/reports"
                              : `/facilities/${"facilityId" in row ? row.facilityId : ""}`;
                  const label =
                    kind === "incidents"
                      ? incidentLabel(row)
                      : "name" in row && row.name
                      ? row.name
                      : "title" in row && row.title
                        ? row.title
                        : "description" in row
                          ? String(row.description).slice(0, 80)
                          : "type" in row
                            ? labelize(String(row.type))
                            : row.id;
                  return (
                    <li key={row.id}>
                      <Link className="text-brand" href={href}>
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
