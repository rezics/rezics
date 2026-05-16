-- engagement-subscription pre-migration snapshot
--
-- Run this against the live `@rezics/server` database BEFORE applying the
-- Prisma migration that introduces Subscription and drops Follow. Capture the
-- output (psql -A -t -f snapshot.sql > snapshot.txt) and keep it alongside the
-- deployment record. Task 9.4 in tasks.md re-runs the equivalent counts after
-- migration and the two snapshots MUST match per design D6 and D8.
--
-- Usage (PowerShell):
--   $env:PGPASSWORD = "<password>"
--   psql -h <host> -U <user> -d <db> -A -t -f snapshot.sql `
--     | Out-File -Encoding utf8 snapshot.before.txt
--
-- Usage (bash):
--   PGPASSWORD=<password> psql -h <host> -U <user> -d <db> -A -t -f snapshot.sql \
--     > snapshot.before.txt

\echo '--- Follow row count (expected to become 0 post-migration; rows backfill into Subscription with channels=[''*''])'
SELECT COUNT(*) AS follow_total FROM "Follow";

\echo '--- RealmMember row count (must equal post-migration Subscription rows where target type=REALM AND no pre-existing duplicate Follow→Subscription)'
SELECT COUNT(*) AS realm_member_total FROM "RealmMember";

\echo '--- User.followersCount / followingsCount totals (each must match post-migration recomputed values per user)'
SELECT
  SUM("followersCount")  AS followers_total,
  SUM("followingsCount") AS followings_total,
  COUNT(*)               AS user_total
FROM "User";

\echo '--- Per-user followers/followings (sample of 20; full set is the join check in 9.4)'
SELECT u."unitId", u."followersCount", u."followingsCount"
FROM "User" u
ORDER BY u."followersCount" DESC NULLS LAST
LIMIT 20;

\echo '--- Distinct (followerId, followingId) pairs (must equal Follow total — no duplicates)'
SELECT COUNT(*) AS distinct_follow_pairs
FROM (SELECT DISTINCT "followerId", "followingId" FROM "Follow") d;

\echo '--- Distinct (realmUnitId, userId) RealmMember pairs (sanity)'
SELECT COUNT(*) AS distinct_realm_member_pairs
FROM (SELECT DISTINCT "realmUnitId", "userId" FROM "RealmMember") d;

\echo '--- Overlap: Follow rows where (followerId, followingId) is also a (userId, realmUnitId) RealmMember pair'
\echo '--- Expected near-zero unless users follow realm units via Follow today (legacy schema permits but UI does not produce)'
SELECT COUNT(*) AS follow_realmmember_overlap
FROM "Follow" f
JOIN "RealmMember" rm
  ON rm."userId" = f."followerId"
 AND rm."realmUnitId" = f."followingId";
