# server-elysia

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

# Library.Book.Backend

Library.Book.Backend

```
git reset --soft HEAD~1
```

## Prisma

```sh
bunx prisma migrate dev --name init
bunx prisma generate
bun run prisma:seed
bun run db:migrate
bunx prisma migrate deploy
bun run ./prisma/seed/utils/passwordReset.ts
# 大型迁移
bunx prisma migrate reset
bun run prisma:seed:echokv

# Linux
npx prisma generate
```

```sh
# Ubuntu 示例
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start

```

```sh
sudo systemctl restart rezbooklib.service
journalctl -u rezbooklib.service -n 50 --no-pager
```

## Encore

```sh
# FTL connection failure
encore daemon restart
```

## Bun 缓存清理

```powershell
Remove-Item "$env:USERPROFILE\.bun\install\cache" -Recurse -Force
```

## PostgreSQL

```powershell
pg_ctl start
# 启动
psql -U postgres

```

## JWT Metadata And Session Routes

The main server now stores JWT service metadata in its own database for both the local issuer and trusted upstream issuers such as auth.

- Canonical server JWKS: `/api/session/jwks`
- Session token issuance: `/api/session/token`
- Trusted auth issuer, audience, and JWKS location are persisted in the local JWT service registry
- `AUTH_JWKS_URL`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, and `MAIN_SESSION_JWT_*` are bootstrap inputs, not the steady-state source of truth

Route policy is explicit:

- Public verification surfaces such as JWKS are exposed with non-credentialed CORS
- Session-protected surfaces stay on the credentialed policy
