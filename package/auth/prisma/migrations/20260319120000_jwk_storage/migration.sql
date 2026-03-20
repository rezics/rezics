ALTER TABLE "Jwks"
ADD COLUMN "publicJwk" JSONB,
ADD COLUMN "privateJwk" JSONB;

UPDATE "Jwks"
SET
  "publicJwk" = CASE
    WHEN "publicKey" LIKE '{%' THEN "publicKey"::jsonb
    ELSE NULL
  END,
  "privateJwk" = CASE
    WHEN "privateKey" LIKE '{%' THEN "privateKey"::jsonb
    ELSE NULL
  END;

DELETE FROM "Jwks"
WHERE "publicJwk" IS NULL OR "privateJwk" IS NULL;

ALTER TABLE "Jwks"
ALTER COLUMN "publicJwk" SET NOT NULL,
ALTER COLUMN "privateJwk" SET NOT NULL;

ALTER TABLE "Jwks"
DROP COLUMN "publicKey",
DROP COLUMN "privateKey",
DROP COLUMN "crv";
