DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*)
    INTO missing_count
  FROM "Unit" release
  WHERE release."workUnitId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "UnitWork" membership
      WHERE membership."unitId" = release."id"
        AND membership."workUnitId" = release."workUnitId"
        AND membership."role" = 'RELEASE'
    );

  IF missing_count > 0 THEN
    RAISE EXCEPTION
      'Cannot drop Unit.workUnitId: % release row(s) lack equivalent UnitWork(role=RELEASE) membership',
      missing_count;
  END IF;
END $$;

DROP VIEW IF EXISTS "UnitWorkReleaseDrift";

ALTER TABLE "Unit" DROP CONSTRAINT IF EXISTS "Unit_workUnitId_fkey";
DROP INDEX IF EXISTS "Unit_workUnitId_idx";
ALTER TABLE "Unit" DROP COLUMN IF EXISTS "workUnitId";
