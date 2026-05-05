INSERT INTO "RealmUnit" ("realmUnitId", "unitId", "createdAt")
SELECT "realmUnitId", "unitId", "createdAt"
FROM "Post"
WHERE "realmUnitId" IS NOT NULL
ON CONFLICT DO NOTHING;
