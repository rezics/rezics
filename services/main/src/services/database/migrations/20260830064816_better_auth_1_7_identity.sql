SET search_path TO public;

-- Modify "accounts" table
-- The pre-1.7 application only creates credential accounts. PostgreSQL stores
-- this constant as missing-value metadata, so adding it does not rewrite the
-- accounts heap; the default also keeps the preceding application reversible.
ALTER TABLE "accounts" ADD COLUMN "issuer" text NOT NULL DEFAULT 'local:credential';
-- Modify "apikeys" table
ALTER TABLE "apikeys" ALTER COLUMN "rate_limit_max" SET DEFAULT 5000;
