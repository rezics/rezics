ALTER TABLE "unit" DROP CONSTRAINT "unit_slug_not_blank";--> statement-breakpoint
DROP INDEX "unit_kind_slug_key";--> statement-breakpoint
CREATE UNIQUE INDEX "unit_slug_scope_slug_key" ON "unit" ("slug_scope_id","slug") WHERE "slug_scope_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unit_slug_root_key" ON "unit" ((true)) WHERE "slug_scope_id" is null;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_slug_address_shape_check" CHECK ((
				"slug_scope_id" is null
				and "slug" is null
				and "kind" = 'slug_namespace'::unit_kind
			) or (
				"slug_scope_id" is not null
				and "slug" is not null
			));--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_slug_label_check" CHECK ("slug" is null or "slug" ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$');--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_slug_scope_not_self_check" CHECK ("slug_scope_id" is null or "slug_scope_id" <> "id");
