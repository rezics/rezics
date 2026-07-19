-- Modify "recommendation_metric_daily" table
ALTER TABLE "recommendation_metric_daily" ALTER COLUMN "impressions" TYPE bigint, ALTER COLUMN "opens" TYPE bigint, ALTER COLUMN "dwell_30s" TYPE bigint, ALTER COLUMN "not_interested" TYPE bigint;
-- Modify "recommendation_unit_stat" table
ALTER TABLE "recommendation_unit_stat" ALTER COLUMN "impressions" TYPE bigint, ALTER COLUMN "opens" TYPE bigint, ALTER COLUMN "dwell_30s" TYPE bigint, ALTER COLUMN "upvotes" TYPE bigint, ALTER COLUMN "downvotes" TYPE bigint, ALTER COLUMN "replies" TYPE bigint, ALTER COLUMN "favorites" TYPE bigint, ALTER COLUMN "shares" TYPE bigint, ALTER COLUMN "high_scores" TYPE bigint, ALTER COLUMN "active_progress" TYPE bigint, ALTER COLUMN "completions" TYPE bigint, ALTER COLUMN "negative_progress" TYPE bigint;
