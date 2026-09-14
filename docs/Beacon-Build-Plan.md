# Beacon — Build Plan

Version 1.1
Platform: Beacon, Spagad Technologies' Operations Management System
Use alongside: Beacon SRS v1.4, Beacon Technical Design v1.1, Beacon Style Guide v1.0

This plan sequences the build so an AI coding agent produces a working, testable slice at the end of each phase rather than a large unfinished system. Each phase lists what to build, what "done" looks like, and a suggested starting prompt for Cursor.

---

## Phase 0 — Project Setup

**Build**: Next.js 14 + TypeScript project, Prisma configured against MySQL, Tailwind + shadcn/ui installed and themed per the Beacon Style Guide (colors, fonts, logo mark component), `.env.example`, base folder structure from the Technical Design doc, CI-friendly lint/format config.

**Done when**: `npm run dev` runs a blank authenticated shell using Beacon's palette and typography (not shadcn defaults); `prisma migrate dev` applies the full schema from the Technical Design doc to a local MySQL database without errors.

**Cursor prompt**: "Set up a Next.js 14 App Router TypeScript project with Tailwind, shadcn/ui, and Prisma configured for MySQL. Use the folder structure and Prisma schema from Beacon-Technical-Design.md, and theme Tailwind/shadcn from Beacon-Style-Guide.md exactly as given."

---

## Phase 1 — Auth, Users, Client Organizations, Facilities

**Build**:
- NextAuth credentials login, password policy, lockout logic (SRS 29.2–29.3)
- User CRUD (Admin), role assignment
- Client Organization and Region CRUD
- Facility CRUD with client org/region linkage
- Facility detail page (SRS 34) — overview section only for now
- `assertFacilityAccess` and the permissions map (Technical Design section 5)

**Done when**: An Admin can create users of each role, create client organizations/regions, create facilities, and each role sees only the facilities they're entitled to see.

**Cursor prompt**: "Build authentication (NextAuth credentials, password policy, account lockout per section 29 of the SRS), then User, Client Organization, Region, and Facility CRUD with the access control rules from Technical Design section 5."

---

## Phase 2 — Assignments and Activities

**Build**:
- Facility assignment management (PM/QA, Developer, Lead designation, one-active-lead enforcement, assignment history)
- Activity creation and facility timeline (SRS 10)
- Team workload view (SRS 18.3)

**Done when**: Multiple PM/QA and developers can be assigned to a facility, exactly one can be active Lead, assignment history is preserved after removal, and activities appear on the facility timeline.

---

## Phase 3 — Incidents and Actions

**Build**:
- Incident CRUD, status workflow, priority, assignment, incident history log
- Action/task CRUD, status, overdue detection
- Facility health rules engine (Technical Design section 6) wired to incident/action changes
- Status override with reason + audit log entry

**Done when**: The incident lifecycle (New → Assigned → In Progress → Awaiting QA → Resolved/Reopened → Closed) works end to end, overdue actions are automatically flagged, and facility health updates automatically per the rule table.

---

## Phase 4 — Reports, Attachments, QA

**Build**:
- Report CRUD for all five types (Site Visit, Incident, QA, Training, Deployment) using the structured `content` field
- PDF, Word (.docx), and Excel/CSV export, built from the shared report templates (Technical Design section 8)
- Attachment upload to S3 (type/size validation, audit-logged deletion)
- QA record CRUD

**Done when**: Each report type's form matches its template in SRS 13.2–13.6, PDF and Word exports use matching formatted layouts per type, attachments upload and download correctly, and QA results feed back into incident status where applicable.

---

## Phase 5 — Handover, Notifications, Audit, Visit Recommendations

**Build**:
- Handover creation with server-built summary snapshot, handover history
- Notification generation (in-app + SES email) for the event list in SRS 20
- Visit recommendation engine (Technical Design section 6) surfaced on dashboard and facility list
- Audit log viewer (Admin)

**Done when**: Initiating a handover produces an accurate snapshot of open items, notifications fire for the listed events, and facilities needing a visit are correctly flagged with a reason.

---

## Phase 6 — Dashboard, Search, Calendar, Analytics

**Build**:
- Dashboard metrics (SRS 18.1–18.3)
- Global search across facilities/users/incidents/activities/actions/reports
- Calendar view of activities and action deadlines
- Analytics views (facility/incident/team insights, SRS 22)

**Done when**: Dashboard load time and search response meet the performance targets in SRS 28, and all three analytics categories return data consistent with the underlying records.

---

## Phase 7 — Data Migration, Hardening, Pilot Readiness

**Build**:
- Data migration script(s) importing cleaned Excel/CSV data into the schema
- Concurrent-edit optimistic locking on high-risk operations (Technical Design section 9)
- RPO/RTO-aligned backup configuration on RDS
- Full pass against the acceptance criteria in SRS section 40

**Done when**: Migrated data is visible and correct in the system, backups are configured per SRS 30, and every item in the SRS acceptance criteria list can be checked off.

---

## After Phase 7

Proceed to UAT (SRS 37.1) with representatives from each role, then the pilot deployment (SRS 38.1) to 5 facilities for 4 weeks against the go/no-go criteria in SRS 38.2, before full rollout.
