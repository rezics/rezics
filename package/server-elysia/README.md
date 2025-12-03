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

``` powershell
pg_ctl start
# 启动
psql -U postgres

```
