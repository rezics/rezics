SET search_path TO public;

CREATE TABLE "oauth_discovery_fetch" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"origin_digest" text NOT NULL,
	"started_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "oauth_discovery_fetch_origin_check" CHECK ("origin_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "oauth_discovery_fetch_time_check" CHECK (isfinite("started_at"))
);

CREATE INDEX "oauth_discovery_fetch_window_idx" ON "oauth_discovery_fetch" ("started_at","id");
