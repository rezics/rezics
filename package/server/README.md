# Library.Book.Backend
Library.Book.Backend

## Prisma

```sh
pnpx prisma migrate dev --name init
pnpx prisma generate
pnpm run prisma:seed
# 大型迁移
encore db reset main
pnpx prisma migrate reset
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
