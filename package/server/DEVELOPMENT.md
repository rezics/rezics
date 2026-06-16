# Development Notes

## Drizzle

```sh
# Run migrations (dev)
task server:db:migrate

# Generate Drizzle migrations
task server:db:generate

# Seed database
task seed

# Deploy migrations (production)
task server:db:deploy

# Reset database (destructive)
task db:ensure
```

### Auth/Main Account Boundary Cutover

The `clean-auth-main-account-boundary` change is a development-stage breaking
cutover. Main `User.emailVerifiedAt` and `User.emailVerificationSource` are
removed; auth login email verification remains auth-owned, while main product
email verification is represented by `EmailVerificationContract` rows.

For local development data, prefer a reset after applying the schema change:

```sh
task db:ensure
task server:db:migrate
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

Production runs as Docker images via Nomad — see
[`docs/guide/deployment.md`](../../docs/guide/deployment.md). Use
`nomad alloc logs <alloc-id>` for logs instead of `journalctl`.

## Bun Cache

```powershell
Remove-Item "$env:USERPROFILE\.bun\install\cache" -Recurse -Force
```
