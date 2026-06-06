# Development Notes

## Drizzle

```sh
# Run migrations (dev)
bun run db:migrate

# Generate Drizzle migrations
bun run db:generate

# Seed database
bun run seed

# Deploy migrations (production)
bun run db:deploy

# Reset database (destructive)
bun run ../../tool/bin/tool.ts db ensure
```

### Auth/Main Account Boundary Cutover

The `clean-auth-main-account-boundary` change is a development-stage breaking
cutover. Main `User.emailVerifiedAt` and `User.emailVerificationSource` are
removed; auth login email verification remains auth-owned, while main product
email verification is represented by `EmailVerificationContract` rows.

For local development data, prefer a reset after applying the schema change:

```sh
bun run ../../tool/bin/tool.ts db ensure
bun run db:migrate
```

If a local database must be kept, migrate one way by creating verified
`EmailVerificationContract` rows for existing `User.email` values before
dropping the old verification columns. Keep this cutover one-way.

## PostgreSQL

```sh
# Ubuntu setup
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

```powershell
# Windows
pg_ctl start
psql -U postgres
```

## Production

Production runs as Docker images via Kamal — see
[`docs/guide/deployment.md`](../../docs/guide/deployment.md). Use
`kamal app logs -r server` for logs instead of `journalctl`.

## Bun Cache

```powershell
Remove-Item "$env:USERPROFILE\.bun\install\cache" -Recurse -Force
```
