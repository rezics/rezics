-- 1. 启用需要的扩展（只需执行一次）
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 维护 searchVector 列，由 Prisma 自动维护

-- 3. 为 searchVector 建 GIN 索引
CREATE INDEX IF NOT EXISTS book_search_idx
  ON "Book" USING gin ("searchVector");

CREATE INDEX IF NOT EXISTS unit_search_idx
  ON "Unit" USING gin ("searchVector");
