# Prisma / SQL Server

Beacon uses **SQL Server** (Docker locally, Azure SQL / RDS in production).

## Source of truth

- `schema.prisma` is the source of truth.
- Apply schema changes with:

```bash
npx prisma generate
npx prisma db push
```

`db push` is preferred over `prisma migrate` because this schema stores former enums/JSON as strings and uses `onDelete: NoAction` FKs that match SQL Server.

## Quarantined MySQL migration

`prisma/migrations_quarantine_mysql/` holds an old MySQL `ENUM`/charset init migration. **Do not run it.** It is kept only for archaeology.

The live `prisma/migrations/` folder may be empty or contain SQL Server baselines only. Until a formal SQL Server migrate workflow is adopted, treat `db push` + this README as the process.

## After every schema edit

1. Update `prisma/schema.prisma`
2. `npx prisma generate`
3. `npx prisma db push` against the target database
4. Commit schema changes (and regenerate notes if CI fails)

Fields such as `Facility.logoS3Key` / `logoFileType` and `Incident.archivedAt` live in the schema and must be pushed to each environment.
