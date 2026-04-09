# Development Notes

## Prisma

```sh
# Run migrations (dev)
bunx prisma migrate dev --name init

# Generate Prisma client
bunx prisma generate

# Seed database
bun run prisma:seed
bun run db:migrate

# Deploy migrations (production)
bunx prisma migrate deploy

# Reset database (destructive)
bunx prisma migrate reset

# Apply existing migrations
bunx prisma migrate deploy

# Linux-specific
npx prisma generate
```

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

## Systemd Service

```sh
sudo systemctl restart rezbooklib.service
journalctl -u rezbooklib.service -n 50 --no-pager
```

## Bun Cache

```powershell
Remove-Item "$env:USERPROFILE\.bun\install\cache" -Recurse -Force
```
