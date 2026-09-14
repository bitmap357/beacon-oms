import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = Record<string, string>;

async function readCsv(path: string) {
  const rows: Row[] = [];
  const parser = createReadStream(path).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true }),
  );
  for await (const record of parser) rows.push(record as Row);
  return rows;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/migrate-csv.ts <path-to-csv>");
    process.exit(1);
  }
  const rows = await readCsv(file);
  let org = await prisma.clientOrganization.findFirst();
  if (!org) {
    org = await prisma.clientOrganization.create({
      data: { name: "Migrated organization", source: "LEGACY" },
    });
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("Seed an admin user before migrating");

  for (const row of rows) {
    const name = row.facility || row.name || row.Facility;
    if (!name) continue;
    const facility = await prisma.facility.upsert({
      where: { id: `legacy-${name.toLowerCase().replaceAll(/\s+/g, "-")}` },
      update: { source: "LEGACY" },
      create: {
        id: `legacy-${name.toLowerCase().replaceAll(/\s+/g, "-")}`,
        name,
        clientOrganizationId: org.id,
        location: row.location || row.Location || null,
        source: "LEGACY",
      },
    });
    if (row.incident || row.Incident) {
      await prisma.incident.create({
        data: {
          title: row.incident || row.Incident,
          facilityId: facility.id,
          description: row.description || row.Description || "Migrated incident",
          reporterId: admin.id,
          priority: (row.priority?.toUpperCase() as never) || "MEDIUM",
          status: "CLOSED",
          source: "LEGACY",
        },
      });
    }
  }
  console.log(`Imported ${rows.length} rows as legacy records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
