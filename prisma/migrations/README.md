# Migrations

Beacon OMS uses SQL Server via `npx prisma db push` (see `prisma/README.md`).

The historical MySQL init migration lives in `prisma/migrations_quarantine_mysql/` and must not be applied.
