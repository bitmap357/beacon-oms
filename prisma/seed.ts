/**
 * Demo data for local SQL Server. Login: admin@spagad.local / Admin!234
 * Ids like fac-focos / inc-lab are stable so you can click them in the UI.
 * Re-run: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import type { IncidentPriority, IncidentStatus, UserRole } from "../src/lib/db-types";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  const password = await hashPassword("Admin!234");
  const users = await Promise.all(
    [
      ["Ama Mensah", "admin@spagad.local", "ADMIN"],
      ["Kwame Boateng", "management@spagad.local", "MANAGEMENT"],
      ["Barbara Asiamah", "barbara@spagad.local", "PM_QA"],
      ["Yaw Owusu", "pm2@spagad.local", "PM_QA"],
      ["Akosua Darko", "dev@spagad.local", "DEVELOPER"],
    ].map(([name, email, role]) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          name,
          email,
          role: role as UserRole,
          passwordHash: password,
        },
      }),
    ),
  );

  const spagad = await prisma.clientOrganization.upsert({
    where: { id: "org-spagad" },
    update: { name: "Spagad Technologies" },
    create: { id: "org-spagad", name: "Spagad Technologies" },
  });

  await prisma.facility.updateMany({
    data: { clientOrganizationId: spagad.id, regionId: null },
  });
  await prisma.region.deleteMany({});
  await prisma.clientOrganization.deleteMany({
    where: { id: { not: "org-spagad" } },
  });

  const facilities = await Promise.all([
    prisma.facility.upsert({
      where: { id: "fac-focos" },
      update: {
        name: "Focos Orthopedics Hospital",
        clientOrganizationId: spagad.id,
        location: "Pantang, Accra",
      },
      create: {
        id: "fac-focos",
        name: "Focos Orthopedics Hospital",
        clientOrganizationId: spagad.id,
        location: "Pantang, Accra",
        contactInfo: "ops@focos.example",
      },
    }),
    prisma.facility.upsert({
      where: { id: "fac-ridge" },
      update: {
        name: "Ridge Surgical Centre",
        clientOrganizationId: spagad.id,
        location: "Ridge, Accra",
      },
      create: {
        id: "fac-ridge",
        name: "Ridge Surgical Centre",
        clientOrganizationId: spagad.id,
        location: "Ridge, Accra",
      },
    }),
    prisma.facility.upsert({
      where: { id: "fac-tema" },
      update: {
        name: "Tema Clinic",
        clientOrganizationId: spagad.id,
        location: "Tema",
      },
      create: {
        id: "fac-tema",
        name: "Tema Clinic",
        clientOrganizationId: spagad.id,
        location: "Tema",
      },
    }),
  ]);

  const branches = await Promise.all(
    [
      ["br-focos-main", "fac-focos", "Main Campus", "Pantang"],
      ["br-focos-lab", "fac-focos", "Laboratory", "Diagnostics block"],
      ["br-focos-records", "fac-focos", "Records", "Admin wing"],
      ["br-ridge-theatre", "fac-ridge", "Theatre", "Surgical floor"],
      ["br-tema-opd", "fac-tema", "Outpatient", "Ground floor"],
    ].map(([id, facilityId, name, location]) =>
      prisma.facilityBranch.upsert({
        where: { id },
        update: { name, location, facilityId },
        create: { id, facilityId, name, location },
      }),
    ),
  );

  const barbara = users.find((row) => row.email === "barbara@spagad.local")!;
  const pm2 = users.find((row) => row.email === "pm2@spagad.local")!;
  const dev = users.find((row) => row.email === "dev@spagad.local")!;

  await prisma.facilityAssignment.deleteMany({
    where: { facilityId: { in: facilities.map((row) => row.id) } },
  });
  await prisma.facilityAssignment.createMany({
    data: [
      { facilityId: "fac-focos", userId: barbara.id, assignmentType: "PM_QA", isLead: true },
      { facilityId: "fac-focos", userId: pm2.id, assignmentType: "PM_QA", isLead: false },
      { facilityId: "fac-focos", userId: dev.id, assignmentType: "DEVELOPER", isLead: false },
      { facilityId: "fac-ridge", userId: barbara.id, assignmentType: "PM_QA", isLead: true },
      { facilityId: "fac-tema", userId: pm2.id, assignmentType: "PM_QA", isLead: true },
      { facilityId: "fac-tema", userId: dev.id, assignmentType: "DEVELOPER", isLead: false },
    ],
  });

  await prisma.activity.upsert({
    where: { id: "act-focos-visit" },
    update: {},
    create: {
      id: "act-focos-visit",
      facilityId: "fac-focos",
      type: "SITE_VISIT",
      date: daysAgo(12),
      startTime: new Date(daysAgo(12).setHours(9, 0, 0, 0)),
      endTime: new Date(daysAgo(12).setHours(12, 30, 0, 0)),
      responsibleUserId: barbara.id,
      createdById: barbara.id,
      description: "Routine site visit covering HIS modules and support queue.",
      findings: "Printer queue delays at records.",
    },
  });
  await prisma.activity.upsert({
    where: { id: "act-ridge-visit" },
    update: {},
    create: {
      id: "act-ridge-visit",
      facilityId: "fac-ridge",
      type: "SITE_VISIT",
      date: daysAgo(3),
      startTime: new Date(daysAgo(3).setHours(10, 0, 0, 0)),
      endTime: new Date(daysAgo(3).setHours(13, 0, 0, 0)),
      responsibleUserId: barbara.id,
      createdById: barbara.id,
      description: "Theatre system review and billing walkthrough.",
    },
  });
  await prisma.activity.upsert({
    where: { id: "act-tema-visit" },
    update: {},
    create: {
      id: "act-tema-visit",
      facilityId: "fac-tema",
      type: "SITE_VISIT",
      date: daysAgo(0),
      startTime: new Date(daysAgo(0).setHours(8, 30, 0, 0)),
      endTime: new Date(daysAgo(0).setHours(11, 0, 0, 0)),
      responsibleUserId: pm2.id,
      createdById: pm2.id,
      description: "OPD follow-up after pharmacy stock sync failure.",
    },
  });

  const sampleIncidents: Array<{
    id: string;
    title: string;
    facilityId: string;
    branchId?: string;
    description: string;
    priority: IncidentPriority;
    status: IncidentStatus;
    assigneeId?: string;
    days: number;
  }> = [
    {
      id: "inc-lab",
      title: "Lab results not posting to HIS",
      facilityId: "fac-focos",
      branchId: "br-focos-lab",
      description: "Results from analyser are not appearing in the patient chart.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      assigneeId: dev.id,
      days: 9,
    },
    {
      id: "inc-printer",
      title: "Records printer queue stalling",
      facilityId: "fac-focos",
      branchId: "br-focos-records",
      description: "Discharge summaries sit in the print queue for 20+ minutes.",
      priority: "MEDIUM",
      status: "NEW",
      assigneeId: pm2.id,
      days: 6,
    },
    {
      id: "inc-login",
      title: "Night staff cannot reset HIS passwords",
      facilityId: "fac-focos",
      branchId: "br-focos-main",
      description: "Self-service reset emails are not arriving on the night shift.",
      priority: "CRITICAL",
      status: "NEW",
      days: 2,
    },
    {
      id: "inc-billing",
      title: "Billing codes missing after tariff update",
      facilityId: "fac-ridge",
      branchId: "br-ridge-theatre",
      description: "Theatre invoices omit the new procedure codes.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      assigneeId: barbara.id,
      days: 18,
    },
    {
      id: "inc-pacs",
      title: "PACS images delayed on ward PCs",
      facilityId: "fac-ridge",
      description: "Radiology images take more than two minutes to open.",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      assigneeId: dev.id,
      days: 27,
    },
    {
      id: "inc-pharmacy",
      title: "Pharmacy stock sync failed overnight",
      facilityId: "fac-tema",
      branchId: "br-tema-opd",
      description: "OPD prescribing shows stale stock figures each morning.",
      priority: "HIGH",
      status: "REOPENED",
      assigneeId: dev.id,
      days: 4,
    },
    {
      id: "inc-closed-theme",
      title: "Theme pack failed to apply on kiosk",
      facilityId: "fac-tema",
      description: "Waiting-area kiosk stayed on the old skin after the last release.",
      priority: "LOW",
      status: "CLOSED",
      assigneeId: pm2.id,
      days: 40,
    },
    {
      id: "inc-training",
      title: "New midwives not provisioned in EMR",
      facilityId: "fac-focos",
      branchId: "br-focos-main",
      description: "Four new staff cannot chart after last week's onboarding.",
      priority: "MEDIUM",
      status: "CLOSED",
      assigneeId: barbara.id,
      days: 21,
    },
  ];

  await prisma.incident.updateMany({ where: { status: "ASSIGNED" }, data: { status: "NEW" } });
  await prisma.incident.updateMany({ where: { status: "AWAITING_QA" }, data: { status: "IN_PROGRESS" } });
  await prisma.incident.updateMany({ where: { status: "RESOLVED" }, data: { status: "CLOSED" } });

  const incidentIds = sampleIncidents.map((row) => row.id);
  await prisma.incidentComment.deleteMany({ where: { incidentId: { in: incidentIds } } });
  await prisma.action.deleteMany({ where: { incidentId: { in: incidentIds } } });
  await prisma.incidentHistory.deleteMany({ where: { incidentId: { in: incidentIds } } });
  await prisma.incident.deleteMany({ where: { id: { in: incidentIds } } });

  for (const row of sampleIncidents) {
    await prisma.incident.create({
      data: {
        id: row.id,
        title: row.title,
        facilityId: row.facilityId,
        branchId: row.branchId,
        description: row.description,
        reporterId: barbara.id,
        assigneeId: row.assigneeId,
        priority: row.priority,
        status: row.status,
        createdAt: daysAgo(row.days),
        reportedAt: daysAgo(row.days),
        resolvedAt: row.status === "CLOSED" ? daysAgo(row.days - 3) : null,
        closedAt: row.status === "CLOSED" ? daysAgo(row.days - 2) : null,
      },
    });
    await prisma.incidentHistory.create({
      data: {
        incidentId: row.id,
        changedById: barbara.id,
        fieldChanged: "status",
        newValue: row.status,
      },
    });
  }

  await prisma.action.deleteMany({
    where: { id: { in: ["actn-analyser", "actn-printer", "actn-billing", "actn-pharmacy", "actn-pacs"] } },
  });
  await prisma.action.createMany({
    data: [
      {
        id: "actn-analyser",
        title: "Patch analyser interface",
        facilityId: "fac-focos",
        ownerId: dev.id,
        incidentId: "inc-lab",
        priority: "HIGH",
        dueDate: daysAgo(2),
        status: "IN_PROGRESS",
      },
      {
        id: "actn-printer",
        title: "Replace records print spooler",
        facilityId: "fac-focos",
        ownerId: pm2.id,
        incidentId: "inc-printer",
        priority: "MEDIUM",
        dueDate: daysAgo(-3),
        status: "NOT_STARTED",
      },
      {
        id: "actn-billing",
        title: "Load new theatre tariff codes",
        facilityId: "fac-ridge",
        ownerId: barbara.id,
        incidentId: "inc-billing",
        priority: "HIGH",
        dueDate: daysAgo(1),
        status: "COMPLETED",
        completedAt: daysAgo(1),
      },
      {
        id: "actn-pharmacy",
        title: "Rerun overnight stock job",
        facilityId: "fac-tema",
        ownerId: dev.id,
        incidentId: "inc-pharmacy",
        priority: "HIGH",
        dueDate: daysAgo(1),
        status: "BLOCKED",
      },
      {
        id: "actn-pacs",
        title: "Tune PACS cache on ward PCs",
        facilityId: "fac-ridge",
        ownerId: dev.id,
        incidentId: "inc-pacs",
        priority: "MEDIUM",
        dueDate: daysAgo(-5),
        status: "IN_PROGRESS",
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: barbara.id,
      action: "incident.created",
      entityType: "Incident",
      entityId: "inc-lab",
      newValue: JSON.stringify({ title: "Lab results not posting to HIS" }),
    },
  });

  void branches;
  console.log("Seed complete. Login as admin@spagad.local / Admin!234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
