-- engagement-subscription post-migration verification
--
-- Run this AFTER applying the Prisma migration that drops Follow and
-- introduces Subscription. Compare the output to snapshot.before.txt
-- captured pre-migration via snapshot.sql (task 9.4). Per design D6 / D8
-- the assertions encoded below MUST hold.
--
-- Usage (PowerShell):
--   $env:PGPASSWORD = "<password>"
--   psql -h <host> -U <user> -d <db> -A -t -f verify.sql `
--     | Out-File -Encoding utf8 snapshot.after.txt
--
-- Usage (bash):
--   PGPASSWORD=<password> psql -h <host> -U <user> -d <db> -A -t -f verify.sql \
--     > snapshot.after.txt
--
-- Then diff snapshot.before.txt against snapshot.after.txt and confirm
-- each assertion line below resolves to "OK".

\echo '--- Follow table is gone (relation should NOT exist)'
SELECT
  CASE
    WHEN to_regclass('"Follow"') IS NULL THEN 'OK: Follow dropped'
    ELSE 'FAIL: Follow still exists'
  END AS follow_dropped;

\echo '--- Subscription row count (must equal pre-migration follow_total + realm_member_total - follow_realmmember_overlap)'
SELECT COUNT(*) AS subscription_total FROM "Subscription";

\echo '--- Subscription rows targeting REALM units (sanity: backfilled from RealmMember)'
SELECT COUNT(*) AS subscription_realm_rows
FROM "Subscription" s
JOIN "Unit" t ON t.id = s."targetUnitId"
WHERE t.type = 'REALM';

\echo '--- Subscription rows targeting USER units (sanity: backfilled from Follow USER→USER)'
SELECT COUNT(*) AS subscription_user_rows
FROM "Subscription" s
JOIN "Unit" t ON t.id = s."targetUnitId"
WHERE t.type = 'USER';

\echo '--- Every Subscription row has channels=[''*''] post-backfill (pre-existing live edges)'
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE channels <> ARRAY[''*'']::text[]) = 0
      THEN 'OK: all backfilled rows use channels=[''*'']'
    ELSE 'WARN: ' || COUNT(*) FILTER (WHERE channels <> ARRAY[''*'']::text[]) || ' rows have non-wildcard channels (only post-cutover writes should differ)'
  END AS channels_wildcard_check
FROM "Subscription";

\echo '--- Unique (subscriberUnitId, targetUnitId) constraint sanity'
SELECT
  CASE
    WHEN COUNT(*) = (SELECT COUNT(*) FROM (SELECT DISTINCT "subscriberUnitId", "targetUnitId" FROM "Subscription") d)
      THEN 'OK: no duplicate edges'
    ELSE 'FAIL: duplicate edges present'
  END AS unique_edge_check
FROM "Subscription";

\echo '--- User.followersCount totals (must equal pre-migration followers_total)'
SELECT SUM("followersCount") AS followers_total, COUNT(*) AS user_total FROM "User";

\echo '--- User.followingsCount totals (must equal pre-migration followings_total)'
SELECT SUM("followingsCount") AS followings_total FROM "User";

\echo '--- Per-user followersCount must match live Subscription count where target is THIS user-unit AND subscriber is a USER unit'
SELECT COUNT(*) AS users_with_drift
FROM "User" u
WHERE u."followersCount" <> (
  SELECT COUNT(*)
  FROM "Subscription" s
  JOIN "Unit" su ON su.id = s."subscriberUnitId"
  WHERE s."targetUnitId" = u."unitId"
    AND su.type = 'USER'
);

\echo '--- Per-user followingsCount must match live Subscription count where subscriber is THIS user-unit AND target is a USER unit'
SELECT COUNT(*) AS users_with_following_drift
FROM "User" u
WHERE u."followingsCount" <> (
  SELECT COUNT(*)
  FROM "Subscription" s
  JOIN "Unit" tu ON tu.id = s."targetUnitId"
  WHERE s."subscriberUnitId" = u."unitId"
    AND tu.type = 'USER'
);

\echo '--- Unit.subscriberCount must match live Subscription count per target'
SELECT COUNT(*) AS units_with_count_drift
FROM "Unit" u
WHERE u."subscriberCount" <> (
  SELECT COUNT(*) FROM "Subscription" s WHERE s."targetUnitId" = u.id
);

\echo '--- RealmMember row count (must equal pre-migration realm_member_total — RealmMember was preserved, not dropped)'
SELECT COUNT(*) AS realm_member_total FROM "RealmMember";

\echo '--- Every RealmMember must have a matching Subscription row (design D5: join writes both edges)'
SELECT COUNT(*) AS realmmember_without_subscription
FROM "RealmMember" rm
WHERE NOT EXISTS (
  SELECT 1 FROM "Subscription" s
  WHERE s."subscriberUnitId" = rm."userId"
    AND s."targetUnitId" = rm."realmUnitId"
);

\echo '--- GIN index on Subscription.channels must exist (enables three-tier wildcard match)'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'Subscription'
        AND indexdef ILIKE '%USING gin%channels%'
    ) THEN 'OK: GIN index on channels present'
    ELSE 'FAIL: GIN index on Subscription.channels missing'
  END AS gin_index_check;
