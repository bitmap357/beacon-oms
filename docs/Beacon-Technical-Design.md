# Beacon — Technical Design

Version 1.1
Platform: Beacon, Spagad Technologies' Operations Management System
Companion documents: Beacon SRS v1.4, Beacon Style Guide v1.0

This document translates the SRS into concrete engineering decisions: stack, data model, API surface, and implementation conventions. It is written to be handed to an AI coding agent (e.g. Cursor) as the source of truth for how the system should be built, so that decisions stay consistent across sessions instead of being re-invented each time.

---

## 1. Stack Decision

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router, TypeScript) | Single codebase for frontend and backend (API routes), server components for fast dashboard loads, strong Cursor/AI-tooling support since it's the most common full-stack TS pattern in training data |
| Database | MySQL 8 | Specified requirement |
| ORM | Prisma | Type-safe queries, migrations, and a schema file that doubles as living documentation — Cursor reads `schema.prisma` directly to understand the data model |
| Auth | NextAuth.js (Credentials provider) + JWT sessions | Matches email/username + password requirement; no external IdP needed for V1 |
| Styling/UI | Tailwind CSS + shadcn/ui, themed per the Beacon Style Guide | Fast to build consistent, accessible components; works responsively out of the box (desktop/tablet/mobile requirement); shadcn's default theme is overridden with Beacon's palette and type tokens rather than left as generic gray |
| Fonts | Space Grotesk (headings/metrics), IBM Plex Sans (body/UI), IBM Plex Mono (IDs/codes) | Loaded via Google Fonts per the Beacon Style Guide type scale |
| File storage | AWS S3 | Matches 20MB attachment requirement and cloud hosting decision |
| Email | AWS SES | In-app + email notification requirement |
| Document export | Puppeteer (PDF) + `docx` npm library (Word) | Both render from the same per-report-type template definition, so PDF and Word exports stay formatted consistently with each other |
| Hosting | AWS (Amplify Hosting for the Next.js app, RDS for MySQL, S3, SES) | Cloud hosting requirement; Amplify keeps deployment simple for a small team, with ECS Fargate as a later upgrade path if the app outgrows it |
| Validation | Zod | Shared validation schemas between client forms and API routes |
| Background jobs | Node cron job (or AWS EventBridge + Lambda later) | For recalculating facility health/visit recommendations and overdue-action checks |

This is a single recommended stack, not a menu — Cursor should treat every choice above as fixed unless you deliberately change it.

---

## 2. Repository Structure

```
spagad-oms/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── facilities/
│   │   │   ├── incidents/
│   │   │   ├── actions/
│   │   │   ├── reports/
│   │   │   ├── qa/
│   │   │   ├── handovers/
│   │   │   ├── calendar/
│   │   │   ├── analytics/
│   │   │   └── admin/
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── facilities/
│   │       ├── incidents/
│   │       ├── actions/
│   │       ├── reports/
│   │       ├── attachments/
│   │       ├── qa/
│   │       ├── handovers/
│   │       ├── notifications/
│   │       ├── dashboard/
│   │       ├── search/
│   │       └── audit/
│   ├── components/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts (Prisma client singleton)
│   │   ├── permissions.ts (RBAC + facility-scoping middleware)
│   │   ├── rules/
│   │   │   ├── facilityHealth.ts
│   │   │   └── visitRecommendation.ts
│   │   ├── audit.ts (audit log writer)
│   │   └── validation/ (Zod schemas)
│   └── types/
├── .env.example
└── README.md
```

---

## 3. UI Theming

Visual identity, palette, typography, logo, and component conventions are fully specified in the **Beacon Style Guide** — implement Tailwind's theme config and shadcn's CSS variables directly from those tokens rather than using shadcn's defaults. In short:

- Map `brand` (`#1F6F78`), `ink`, `slate`, `surface`, `surface-raised`, and `hairline` from the Style Guide into `tailwind.config.ts` as named colors.
- Map the five facility-status colors (Healthy/Attention Required/At Risk/Critical/Inactive) as a dedicated `status` color group — the same tokens are used everywhere a status pill renders (dashboard, facility list, facility detail, notifications), never redefined locally per screen.
- Load Space Grotesk, IBM Plex Sans, and IBM Plex Mono and assign them per the Style Guide's type scale.
- Build the logo mark (dot + concentric arcs) as a reusable SVG component; never recolor it per status.

## 4. Data Model

The full Prisma schema is below. Notes on design choices:

- **Reports use a `content` JSON column** rather than one giant table with nullable columns per report type. Each report's `type` determines which fields are expected in `content` (see the five templates in SRS section 13). This keeps the schema clean while MySQL's native JSON type still allows querying into it if needed later.
- **One active Lead PM/QA per facility** cannot be enforced with a MySQL partial unique index (MySQL doesn't support them). Enforce this in application logic inside the assignment service (check-then-write inside a transaction), and add a regular index on `(facilityId, isLead, isActive)` to make that check fast.
- **Audit and incident history are append-only** — never updated or deleted, only inserted.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  PM_QA
  DEVELOPER
  MANAGEMENT
  ADMIN
}

enum AssignmentType {
  PM_QA
  DEVELOPER
}

enum FacilityHealth {
  HEALTHY
  ATTENTION_REQUIRED
  AT_RISK
  CRITICAL
  INACTIVE
}

enum ActivityType {
  SITE_VISIT
  TRAINING
  DEMONSTRATION
  DEPLOYMENT
  QA
  MEETING
  FOLLOW_UP
  SUPPORT
  INSTALLATION
  SYSTEM_REVIEW
  OTHER
}

enum IncidentPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum IncidentStatus {
  NEW
  ASSIGNED
  IN_PROGRESS
  AWAITING_QA
  REOPENED
  RESOLVED
  CLOSED
}

enum ActionStatus {
  NOT_STARTED
  IN_PROGRESS
  BLOCKED
  COMPLETED
  CANCELLED
}

enum ReportType {
  SITE_VISIT
  INCIDENT
  QA
  TRAINING
  DEPLOYMENT
}

enum ReportStatus {
  DRAFT
  SUBMITTED
  REVIEWED
}

enum QAResult {
  PASSED
  FAILED
  PASSED_WITH_ISSUES
  REQUIRES_RETEST
}

enum AttachmentRelatedType {
  ACTIVITY
  INCIDENT
  REPORT
  QA_RECORD
}

enum NotificationType {
  INCIDENT_ASSIGNED
  INCIDENT_STATUS_CHANGED
  INCIDENT_REOPENED
  ACTION_ASSIGNED
  ACTION_DUE_SOON
  ACTION_OVERDUE
  VISIT_DUE
  QA_VERIFICATION_REQUIRED
  HANDOVER_INITIATED
  HANDOVER_COMPLETED
  REPORT_NEEDS_REVIEW
}

model User {
  id                 String   @id @default(cuid())
  name               String
  email              String   @unique
  passwordHash       String
  role               UserRole
  isActive           Boolean  @default(true)
  failedLoginCount   Int      @default(0)
  lockedUntil        DateTime?
  mustResetPassword  Boolean  @default(false)
  passwordUpdatedAt  DateTime @default(now())
  lastLoginAt        DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  facilityAssignments FacilityAssignment[]
  activitiesResponsible Activity[]        @relation("ActivityResponsible")
  activitiesCreated   Activity[]          @relation("ActivityCreatedBy")
  incidentsReported   Incident[]          @relation("IncidentReporter")
  incidentsAssigned   Incident[]          @relation("IncidentAssignee")
  actionsOwned        Action[]
  reportsAuthored     Report[]
  qaRecords           QARecord[]
  handoversFrom       Handover[]          @relation("HandoverFrom")
  handoversTo         Handover[]          @relation("HandoverTo")
  handoversInitiated  Handover[]          @relation("HandoverInitiator")
  notifications       Notification[]
  auditLogs           AuditLog[]
  attachmentsUploaded Attachment[]        @relation("AttachmentUploader")
}

model ClientOrganization {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

  regions   Region[]
  facilities Facility[]
}

model Region {
  id                   String   @id @default(cuid())
  name                 String
  clientOrganizationId String
  clientOrganization   ClientOrganization @relation(fields: [clientOrganizationId], references: [id])
  facilities           Facility[]

  @@index([clientOrganizationId])
}

model Facility {
  id                    String   @id @default(cuid())
  name                  String
  clientOrganizationId  String
  clientOrganization    ClientOrganization @relation(fields: [clientOrganizationId], references: [id])
  regionId              String?
  region                Region?  @relation(fields: [regionId], references: [id])
  location              String?
  contactInfo           String?
  status                FacilityHealth @default(HEALTHY)
  statusOverride        Boolean  @default(false)
  statusOverrideReason  String?
  statusOverrideById    String?
  statusOverrideAt      DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  assignments  FacilityAssignment[]
  activities   Activity[]
  incidents    Incident[]
  actions      Action[]
  reports      Report[]
  qaRecords    QARecord[]
  handovers    Handover[]

  @@index([clientOrganizationId])
  @@index([regionId])
  @@index([status])
}

model FacilityAssignment {
  id             String   @id @default(cuid())
  facilityId     String
  facility       Facility @relation(fields: [facilityId], references: [id])
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  assignmentType AssignmentType
  isLead         Boolean  @default(false)
  startDate      DateTime @default(now())
  endDate        DateTime?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())

  @@index([facilityId, isLead, isActive])
  @@index([userId, isActive])
}

model Activity {
  id                String   @id @default(cuid())
  facilityId        String
  facility          Facility @relation(fields: [facilityId], references: [id])
  type              ActivityType
  date              DateTime
  startTime         DateTime?
  endTime           DateTime?
  responsibleUserId String
  responsibleUser   User     @relation("ActivityResponsible", fields: [responsibleUserId], references: [id])
  description       String   @db.Text
  findings          String?  @db.Text
  notes             String?  @db.Text
  createdById       String
  createdBy         User     @relation("ActivityCreatedBy", fields: [createdById], references: [id])
  createdAt         DateTime @default(now())

  participants ActivityParticipant[]
  incidents    Incident[]
  reports      Report[]
  attachments  Attachment[]

  @@index([facilityId, date])
}

model ActivityParticipant {
  id         String   @id @default(cuid())
  activityId String
  activity   Activity @relation(fields: [activityId], references: [id])
  userId     String

  @@index([activityId])
}

model Incident {
  id                 String   @id @default(cuid())
  title              String
  facilityId         String
  facility           Facility @relation(fields: [facilityId], references: [id])
  description        String   @db.Text
  reporterId         String
  reporter           User     @relation("IncidentReporter", fields: [reporterId], references: [id])
  priority           IncidentPriority
  status             IncidentStatus @default(NEW)
  assigneeId         String?
  assignee           User?    @relation("IncidentAssignee", fields: [assigneeId], references: [id])
  relatedActivityId  String?
  relatedActivity    Activity? @relation(fields: [relatedActivityId], references: [id])
  dueDate            DateTime?
  resolutionInfo     String?  @db.Text
  resolvedAt         DateTime?
  closedAt           DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  history     IncidentHistory[]
  actions     Action[]
  reports     Report[]
  qaRecords   QARecord[]
  attachments Attachment[]

  @@index([facilityId, status])
  @@index([priority, status])
}

model IncidentHistory {
  id             String   @id @default(cuid())
  incidentId     String
  incident       Incident @relation(fields: [incidentId], references: [id])
  changedById    String
  fieldChanged   String
  oldValue       String?
  newValue       String?
  changedAt      DateTime @default(now())

  @@index([incidentId])
}

model Action {
  id           String   @id @default(cuid())
  title        String
  description  String?  @db.Text
  facilityId   String
  facility     Facility @relation(fields: [facilityId], references: [id])
  ownerId      String
  owner        User     @relation(fields: [ownerId], references: [id])
  sourceType   String?
  sourceId     String?
  incidentId   String?
  incident     Incident? @relation(fields: [incidentId], references: [id])
  priority     IncidentPriority
  dueDate      DateTime
  status       ActionStatus @default(NOT_STARTED)
  completedAt  DateTime?
  notes        String?  @db.Text
  createdAt    DateTime @default(now())

  @@index([facilityId, status])
  @@index([ownerId, status])
  @@index([dueDate, status])
}

model Report {
  id          String   @id @default(cuid())
  type        ReportType
  facilityId  String
  facility    Facility @relation(fields: [facilityId], references: [id])
  activityId  String?
  activity    Activity? @relation(fields: [activityId], references: [id])
  incidentId  String?
  incident    Incident? @relation(fields: [incidentId], references: [id])
  authorId    String
  author      User     @relation(fields: [authorId], references: [id])
  date        DateTime
  status      ReportStatus @default(DRAFT)
  content     Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  attachments Attachment[]

  @@index([facilityId, type])
}

model Attachment {
  id             String   @id @default(cuid())
  fileName       String
  fileType       String
  fileSizeBytes  Int
  s3Key          String
  uploadedById   String
  uploadedBy     User     @relation("AttachmentUploader", fields: [uploadedById], references: [id])
  relatedType    AttachmentRelatedType
  activityId     String?
  activity       Activity? @relation(fields: [activityId], references: [id])
  incidentId     String?
  incident       Incident? @relation(fields: [incidentId], references: [id])
  reportId       String?
  report         Report?  @relation(fields: [reportId], references: [id])
  qaRecordId     String?
  qaRecord       QARecord? @relation(fields: [qaRecordId], references: [id])
  createdAt      DateTime @default(now())
  deletedAt      DateTime?
  deletedById    String?

  @@index([relatedType, activityId])
  @@index([relatedType, incidentId])
}

model QARecord {
  id                  String   @id @default(cuid())
  facilityId          String
  facility            Facility @relation(fields: [facilityId], references: [id])
  relatedIncidentId   String?
  relatedIncident     Incident? @relation(fields: [relatedIncidentId], references: [id])
  qaUserId            String
  qaUser              User     @relation(fields: [qaUserId], references: [id])
  qaDate              DateTime
  itemsTested         Json?
  result              QAResult
  findings            String?  @db.Text
  requiredCorrections String?  @db.Text
  retestDate          DateTime?
  finalVerification   Boolean  @default(false)
  createdAt           DateTime @default(now())

  attachments Attachment[]

  @@index([facilityId, result])
}

model Handover {
  id            String   @id @default(cuid())
  facilityId    String
  facility      Facility @relation(fields: [facilityId], references: [id])
  fromUserId    String?
  fromUser      User?    @relation("HandoverFrom", fields: [fromUserId], references: [id])
  toUserId      String?
  toUser        User?    @relation("HandoverTo", fields: [toUserId], references: [id])
  initiatedById String
  initiatedBy   User     @relation("HandoverInitiator", fields: [initiatedById], references: [id])
  summarySnapshot Json
  notes         String?  @db.Text
  createdAt     DateTime @default(now())

  @@index([facilityId])
}

model Notification {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  type        NotificationType
  relatedType String?
  relatedId   String?
  message     String
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([userId, isRead])
}

model AuditLog {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  action        String
  entityType    String
  entityId      String
  previousValue Json?
  newValue      Json?
  createdAt     DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
}
```

---

## 5. Access Control Implementation

Access control is **role-based and facility-based** (SRS section 24), scoped further by client organization (SRS section 8.2).

Implementation pattern:

1. Every API route that touches a facility-scoped resource calls a shared `assertFacilityAccess(userId, facilityId)` helper before running the query.
2. The helper resolves the user's role and, for PM_QA/DEVELOPER, checks for an active `FacilityAssignment` (or, if scoping by organization is needed, that the facility's `clientOrganizationId` is one the user is assigned to). MANAGEMENT and ADMIN bypass the facility check but are still subject to role-based function checks.
3. Role-based function checks (e.g. "can this role manage users") live in `lib/permissions.ts` as a single permissions map, not scattered `if (role === ...)` checks across route handlers — this keeps the permissions matrix in the SRS and the code in sync.

---

## 6. Facility Health and Visit Recommendation Engines

Both are pure functions in `lib/rules/`, called synchronously whenever a relevant record changes (incident created/updated, action overdue, QA recorded) and also on a nightly batch job as a safety net.

```ts
// lib/rules/facilityHealth.ts (pseudocode matching SRS 7.2)
function calculateFacilityHealth(facility): FacilityHealth {
  const openIncidents = countOpenIncidents(facility);
  const highPriorityOpen = countOpenIncidents(facility, { priority: ["HIGH", "CRITICAL"] });
  const overdueActions = countOverdueActions(facility);
  const oldPendingQA = countPendingQA(facility, { olderThanDays: 7 });
  const criticalOpen = countOpenIncidents(facility, { priority: "CRITICAL" });
  const unresolvedHighOver7Days = countUnresolvedHighPriorityOlderThan(facility, 7);

  if (criticalOpen > 0 || unresolvedHighOver7Days >= 2 || facility.managementMarkedCritical) return "CRITICAL";
  if (openIncidents >= 3 || highPriorityOpen >= 2 || overdueActions >= 3 || unresolvedHighOver7Days >= 1) return "AT_RISK";
  if (openIncidents >= 1 || overdueActions >= 1 || oldPendingQA > 0) return "ATTENTION_REQUIRED";
  return "HEALTHY";
}
```

```ts
// lib/rules/visitRecommendation.ts (pseudocode matching SRS 17)
function calculateVisitRecommendation(facility) {
  const daysSinceLastVisit = getDaysSinceLastVisit(facility);
  const openIncidents = countOpenIncidents(facility);
  const overdueActions = countOverdueActions(facility);
  const criticalOpen = countOpenIncidents(facility, { priority: "CRITICAL" });
  const highOpen = countOpenIncidents(facility, { priority: "HIGH" });
  const managementRequested = facility.managementRequestedUrgentVisit;

  if (criticalOpen > 0 || highOpen >= 2 || managementRequested) {
    return { recommendation: "URGENT_VISIT", reason: buildReason({ criticalOpen, highOpen, managementRequested }) };
  }
  if (daysSinceLastVisit >= 30) {
    return { recommendation: "VISIT_DUE", reason: `${daysSinceLastVisit} days since last visit` };
  }
  if (daysSinceLastVisit >= 21 || openIncidents >= 2 || overdueActions >= 2) {
    return { recommendation: "VISIT_RECOMMENDED", reason: buildReason({ daysSinceLastVisit, openIncidents, overdueActions }) };
  }
  return { recommendation: "NOT_DUE", reason: null };
}
```

`statusOverride` on the Facility model takes precedence over the calculated value whenever `statusOverride = true`; the calculation still runs in the background so the underlying (non-overridden) value stays current for when the override is lifted.

---

## 7. API Contract

All routes are under `/api`, return JSON, and require an authenticated session unless noted. Role/scope restrictions reference SRS section 24's permissions matrix.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | Email/username + password; returns session cookie/JWT |
| POST | `/api/auth/logout` | |
| POST | `/api/auth/forgot-password` | Triggers reset email |
| POST | `/api/auth/reset-password` | |

### Users (Admin only, except self)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/users` | Admin, Management (read-only) |
| POST | `/api/users` | Admin — create user |
| GET/PATCH | `/api/users/:id` | Admin; self can PATCH own profile |
| POST | `/api/users/:id/deactivate` | Admin |
| POST | `/api/users/:id/force-reset` | Admin |

### Client Organizations & Regions
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/client-organizations` | Admin write, all roles read (scoped) |
| GET/PATCH | `/api/client-organizations/:id` | |
| GET/POST | `/api/client-organizations/:id/regions` | |

### Facilities
| Method | Path | Notes |
|---|---|---|
| GET | `/api/facilities` | Scoped by role/org; supports filters (status, org, region) |
| POST | `/api/facilities` | Admin, Management |
| GET/PATCH | `/api/facilities/:id` | Facility-scoped |
| POST | `/api/facilities/:id/status-override` | Authorized roles only; requires reason |
| GET | `/api/facilities/:id/timeline` | Combined activity/incident/handover feed |

### Assignments
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/facilities/:id/assignments` | |
| PATCH | `/api/assignments/:id` | End assignment, change lead |

### Activities
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/activities` | Filter by facility, type, date range |
| GET/PATCH | `/api/activities/:id` | |

### Incidents
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/incidents` | Filter by facility, status, priority |
| GET/PATCH | `/api/incidents/:id` | PATCH writes an IncidentHistory row |
| GET | `/api/incidents/:id/history` | |

### Actions
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/actions` | Filter by facility, owner, status, overdue |
| GET/PATCH | `/api/actions/:id` | |

### Reports
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/reports` | `type` determines expected `content` shape |
| GET/PATCH | `/api/reports/:id` | |
| GET | `/api/reports/:id/export?format=pdf\|docx\|xlsx` | PDF and Word use the shared report template (see section 8); Excel/CSV export the raw field data |

### Attachments
| Method | Path | Notes |
|---|---|---|
| POST | `/api/attachments` | Multipart upload → S3; validates type/size |
| DELETE | `/api/attachments/:id` | Authorized users only; audit-logged |

### QA
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/qa-records` | |
| GET/PATCH | `/api/qa-records/:id` | |

### Handovers
| Method | Path | Notes |
|---|---|---|
| POST | `/api/facilities/:id/handovers` | Builds summary snapshot server-side |
| GET | `/api/facilities/:id/handovers` | History |

### Notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications` | Current user's notifications |
| PATCH | `/api/notifications/:id/read` | |

### Dashboard / Search / Analytics / Audit
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard` | Aggregated metrics, scoped to user |
| GET | `/api/search?q=` | Cross-entity search |
| GET | `/api/analytics/*` | Facility/incident/team insights |
| GET | `/api/audit` | Admin only |

---

## 8. Report Export (PDF and Word)

Each of the five report types (SRS 13.2–13.6) has one template definition in `lib/reportTemplates/` that both export formats render from, so a layout fix in one format can't silently go stale in the other. A template defines:

- A header block: facility name, client organization, report type, date, author
- The section order and headings, matching the field list in the SRS for that report type exactly
- Which fields render as tables (e.g. findings, test results, action items) versus paragraph text
- Shared typography/spacing rules

**PDF**: the template renders to styled HTML (React server component) and is printed to PDF via Puppeteer — gives precise control over page breaks, headers/footers, and table layout.

**Word**: the same report data is passed through the `docx` npm library, using the identical heading structure and tables as the PDF template, so the two documents read the same way even though they're generated by different renderers.

**Excel/CSV**: exports the raw field data in tabular form (for aggregate reports like team workload or facility health, not for reformatting a single narrative report).

## 9. Non-Functional Implementation Notes

- **Performance (SRS 28)**: index every foreign key and every filter field used above (already reflected in the Prisma schema's `@@index` blocks); paginate all list endpoints by default (25–50 rows).
- **Security (SRS 29)**: hash passwords with bcrypt (cost factor 12); enforce the password policy and lockout via Zod validation + the `failedLoginCount`/`lockedUntil` fields on `User`; all traffic over HTTPS/TLS via the hosting platform; S3 bucket private with signed URLs for attachment access.
- **Concurrent edits (SRS 26.1)**: use Prisma's `updatedAt` as an optimistic-concurrency check on PATCH routes for high-risk operations (facility assignment changes, closing critical incidents, Lead PM/QA changes) — reject the write with a 409 if the client's `updatedAt` doesn't match, and have the UI re-fetch and show the latest state.
- **Audit trail (SRS 23)**: every mutation on an audited entity type writes an `AuditLog` row inside the same transaction as the mutation, via a shared `logAudit()` helper — never as an afterthought in the route handler.
- **Notifications (SRS 20)**: write to `Notification` synchronously; send email via SES asynchronously (don't block the API response on SES).
