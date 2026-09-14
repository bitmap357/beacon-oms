# Beacon

Operations management system for Spagad Technologies. Facilities, assignments, incidents, actions, reports, QA, handovers, and an append-only audit trail.

## Local setup

1. Copy `.env.example` to `.env` and keep the generated `AUTH_SECRET`.
2. Start infrastructure:

```bash
docker compose up -d
```

3. Apply schema and seed:

```bash
npx prisma db push
npx prisma db seed
```

Local SQL Server runs in Docker (`sa` / see `.env.example`). Prisma `db push` is used instead of migrate because SQL Server does not support Prisma enums or JSON — those fields are stored as strings.

4. Run the app and worker:

```bash
npm run dev
npm run worker
```

Sign in with `admin@spagad.local` / `Admin!234`. Mail is caught at http://localhost:8025. MinIO console is http://localhost:9001 (`beacon` / `beaconbeacon`).

## Stack

Next.js 16 App Router, Auth.js credentials + JWT (30-minute idle), Prisma/SQL Server, Argon2id, Redis rate limits, MinIO/S3 attachments, Mailpit/SES email, amCharts 5 dashboards.

## Security

- Role + facility scoped access in `src/lib/permissions.ts`
- Audit writes in the same transaction as mutations
- Attachment allowlist, 20 MB cap, magic-byte check, signed URLs
- Account lockout after 5 failures, escalating windows
- Security headers in `next.config.ts`

## Production notes

Point `DATABASE_URL` at Azure SQL or RDS SQL Server, `S3_*` at a private bucket, and SMTP at SES. Configure automated backups for RPO 24h / RTO 8h (SRS 30). Hosting location must be approved by Spagad before go-live.

## Data migration

```bash
npx tsx scripts/migrate-csv.ts path/to/export.csv
```

Expected columns: `facility`, `location`, optional `incident`, `description`, `priority`. Migrated rows are marked `LEGACY`.

## SRS 40 checklist

Use the running app to confirm facilities, assignments (one lead), activities, incidents, QA, actions/overdue, dashboard, handovers, search, audit, and role-scoped access.
