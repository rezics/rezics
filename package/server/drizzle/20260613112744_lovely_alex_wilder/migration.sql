ALTER TABLE "CreditAttribution" RENAME COLUMN "sortOrder" TO "position";--> statement-breakpoint
ALTER TABLE "SubjectAttribution" RENAME COLUMN "sortOrder" TO "position";--> statement-breakpoint
ALTER TABLE "UnitExternalLink" RENAME COLUMN "sortOrder" TO "position";--> statement-breakpoint
ALTER TABLE "ScoreRealmField" RENAME COLUMN "sortOrder" TO "position";--> statement-breakpoint
ALTER TABLE "UnitSupportLanguage" RENAME COLUMN "sortOrder" TO "position";--> statement-breakpoint
DROP INDEX "CreditAttribution_unitId_role_sortOrder_idx";--> statement-breakpoint
DROP INDEX "SubjectAttribution_entityId_role_sortOrder_idx";--> statement-breakpoint
DROP INDEX "SubjectAttribution_entityId_sortOrder_idx";--> statement-breakpoint
DROP INDEX "SubjectAttribution_unitId_role_sortOrder_idx";--> statement-breakpoint
DROP INDEX "UnitExternalLink_unitId_sortOrder_id_idx";--> statement-breakpoint
DROP INDEX "UnitExternalLink_unitId_sourceEntityUnitId_sortOrder_idx";--> statement-breakpoint
DROP INDEX "ScoreRealmField_realm_sortOrder_idx";--> statement-breakpoint
DROP INDEX "ZonePage_zoneUnitId_position_idx";--> statement-breakpoint
ALTER TABLE "CreditAttribution" ALTER COLUMN "position" SET DATA TYPE varchar(64) USING "position"::varchar(64);--> statement-breakpoint
ALTER TABLE "CreditAttribution" ALTER COLUMN "position" SET DEFAULT 'V';--> statement-breakpoint
ALTER TABLE "SubjectAttribution" ALTER COLUMN "position" SET DATA TYPE varchar(64) USING "position"::varchar(64);--> statement-breakpoint
ALTER TABLE "SubjectAttribution" ALTER COLUMN "position" SET DEFAULT 'V';--> statement-breakpoint
ALTER TABLE "UnitExternalLink" ALTER COLUMN "position" SET DATA TYPE varchar(64) USING "position"::varchar(64);--> statement-breakpoint
ALTER TABLE "UnitExternalLink" ALTER COLUMN "position" SET DEFAULT 'V';--> statement-breakpoint
ALTER TABLE "ScoreRealmField" ALTER COLUMN "position" SET DATA TYPE varchar(64) USING "position"::varchar(64);--> statement-breakpoint
ALTER TABLE "ScoreRealmField" ALTER COLUMN "position" SET DEFAULT 'V';--> statement-breakpoint
ALTER TABLE "UnitSupportLanguage" ALTER COLUMN "position" SET DATA TYPE varchar(64) USING "position"::varchar(64);--> statement-breakpoint
ALTER TABLE "UnitSupportLanguage" ALTER COLUMN "position" SET DEFAULT 'V';--> statement-breakpoint
ALTER TABLE "ZonePage" ALTER COLUMN "position" SET DATA TYPE varchar(64) USING "position"::varchar(64);--> statement-breakpoint
ALTER TABLE "ZonePage" ALTER COLUMN "position" SET DEFAULT 'V';--> statement-breakpoint
CREATE FUNCTION "__rezics_fractional_position"(ordinal integer, total integer) RETURNS varchar AS $$
DECLARE
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  base integer := length(alphabet);
  digits integer := 1;
  capacity numeric := base;
  step numeric;
  value numeric;
  digit integer;
  output text := '';
BEGIN
  WHILE capacity <= total + 1 LOOP
    digits := digits + 1;
    capacity := capacity * base;
  END LOOP;

  step := floor(capacity / (total + 1));
  value := step * ordinal;

  WHILE value > 0 LOOP
    digit := mod(value, base)::integer;
    output := substr(alphabet, digit + 1, 1) || output;
    value := floor(value / base);
  END LOOP;

  RETURN lpad(output, digits, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;--> statement-breakpoint
WITH ranked AS (
  SELECT
    "unitId",
    "entityId",
    "role",
    row_number() OVER (PARTITION BY "unitId", "role" ORDER BY "position"::integer, "entityId") AS ordinal,
    count(*) OVER (PARTITION BY "unitId", "role") AS total
  FROM "CreditAttribution"
)
UPDATE "CreditAttribution"
SET "position" = "__rezics_fractional_position"(ranked.ordinal::integer, ranked.total::integer)
FROM ranked
WHERE "CreditAttribution"."unitId" = ranked."unitId"
  AND "CreditAttribution"."entityId" = ranked."entityId"
  AND "CreditAttribution"."role" = ranked."role";--> statement-breakpoint
WITH ranked AS (
  SELECT
    "unitId",
    "entityId",
    "role",
    row_number() OVER (PARTITION BY "unitId", "role" ORDER BY "position"::integer, "entityId") AS ordinal,
    count(*) OVER (PARTITION BY "unitId", "role") AS total
  FROM "SubjectAttribution"
)
UPDATE "SubjectAttribution"
SET "position" = "__rezics_fractional_position"(ranked.ordinal::integer, ranked.total::integer)
FROM ranked
WHERE "SubjectAttribution"."unitId" = ranked."unitId"
  AND "SubjectAttribution"."entityId" = ranked."entityId"
  AND "SubjectAttribution"."role" = ranked."role";--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "unitId" ORDER BY "position"::integer, "id") AS ordinal,
    count(*) OVER (PARTITION BY "unitId") AS total
  FROM "UnitExternalLink"
)
UPDATE "UnitExternalLink"
SET "position" = "__rezics_fractional_position"(ranked.ordinal::integer, ranked.total::integer)
FROM ranked
WHERE "UnitExternalLink"."id" = ranked."id";--> statement-breakpoint
WITH ranked AS (
  SELECT
    "realm",
    "key",
    row_number() OVER (PARTITION BY "realm" ORDER BY "position"::integer, "key") AS ordinal,
    count(*) OVER (PARTITION BY "realm") AS total
  FROM "ScoreRealmField"
)
UPDATE "ScoreRealmField"
SET "position" = "__rezics_fractional_position"(ranked.ordinal::integer, ranked.total::integer)
FROM ranked
WHERE "ScoreRealmField"."realm" = ranked."realm"
  AND "ScoreRealmField"."key" = ranked."key";--> statement-breakpoint
WITH ranked AS (
  SELECT
    "unitId",
    "language",
    row_number() OVER (PARTITION BY "unitId" ORDER BY "position"::integer, "language") AS ordinal,
    count(*) OVER (PARTITION BY "unitId") AS total
  FROM "UnitSupportLanguage"
)
UPDATE "UnitSupportLanguage"
SET "position" = "__rezics_fractional_position"(ranked.ordinal::integer, ranked.total::integer)
FROM ranked
WHERE "UnitSupportLanguage"."unitId" = ranked."unitId"
  AND "UnitSupportLanguage"."language" = ranked."language";--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "zoneUnitId" ORDER BY "position"::integer, "id") AS ordinal,
    count(*) OVER (PARTITION BY "zoneUnitId") AS total
  FROM "ZonePage"
)
UPDATE "ZonePage"
SET "position" = "__rezics_fractional_position"(ranked.ordinal::integer, ranked.total::integer)
FROM ranked
WHERE "ZonePage"."id" = ranked."id";--> statement-breakpoint
DROP FUNCTION "__rezics_fractional_position"(integer, integer);--> statement-breakpoint
CREATE INDEX "CreditAttribution_unitId_role_position_entityId_idx" ON "CreditAttribution" ("unitId","role","position","entityId");--> statement-breakpoint
CREATE INDEX "SubjectAttribution_entityId_role_position_unitId_idx" ON "SubjectAttribution" ("entityId","role","position","unitId");--> statement-breakpoint
CREATE INDEX "SubjectAttribution_entityId_position_unitId_idx" ON "SubjectAttribution" ("entityId","position","unitId");--> statement-breakpoint
CREATE INDEX "SubjectAttribution_unitId_role_position_entityId_idx" ON "SubjectAttribution" ("unitId","role","position","entityId");--> statement-breakpoint
CREATE INDEX "UnitExternalLink_unitId_position_id_idx" ON "UnitExternalLink" ("unitId","position","id");--> statement-breakpoint
CREATE INDEX "UnitExternalLink_unitId_sourceEntityUnitId_position_idx" ON "UnitExternalLink" ("unitId","sourceEntityUnitId","position","id");--> statement-breakpoint
CREATE INDEX "ScoreRealmField_realm_position_key_idx" ON "ScoreRealmField" ("realm","position","key");--> statement-breakpoint
CREATE INDEX "UnitSupportLanguage_unitId_position_language_idx" ON "UnitSupportLanguage" ("unitId","position","language");--> statement-breakpoint
CREATE INDEX "ZonePage_zoneUnitId_position_id_idx" ON "ZonePage" ("zoneUnitId","position","id");
