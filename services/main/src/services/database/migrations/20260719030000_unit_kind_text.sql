-- Fail instead of waiting indefinitely for an incompatible concurrent schema operation.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "unit" DROP CONSTRAINT "unit_slug_address_shape_check";

ALTER TABLE "unit"
	ALTER COLUMN "kind" TYPE text USING "kind"::text;

ALTER TABLE "unit" ADD CONSTRAINT "unit_kind_check" CHECK ("kind" IN (
	'slug_namespace',
	'redirect',
	'profile',
	'book',
	'software',
	'media',
	'release',
	'entity',
	'tag',
	'series',
	'zone',
	'collection',
	'post',
	'poll',
	'realm',
	'realm_rule'
));

ALTER TABLE "unit" ADD CONSTRAINT "unit_slug_address_shape_check" CHECK ((
	"slug_scope_id" IS NULL
	AND "slug" IS NULL
	AND "kind" = 'slug_namespace'
) OR (
	"slug_scope_id" IS NOT NULL
	AND "slug" IS NOT NULL
));

DROP TYPE "unit_kind";
