import { and, eq, exists, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { database } from "../database";
import { post } from "../database/schema";

export const ResourceSectionValues = [
	"book",
	"software",
	"media",
	"entity",
	"tag",
	"realm",
	"zone",
	"post",
	"wiki",
	"collection",
	"review",
	"poll",
] as const;
export type ResourceSection = (typeof ResourceSectionValues)[number];

type SectionTarget = { readonly id: AnyPgColumn; readonly kind: AnyPgColumn };

/** Maps a product resource section to its canonical Unit discriminator. */
export function resourceSectionCondition(section: ResourceSection, target: SectionTarget): SQL {
	switch (section) {
		case "post":
		case "review":
		case "wiki":
			return and(
				eq(target.kind, "post"),
				exists(
					database
						.select({ id: post.id })
						.from(post)
						.where(and(eq(post.id, target.id), eq(post.kind, section))),
				),
			) as SQL;
		case "book":
		case "software":
		case "media":
		case "entity":
		case "tag":
		case "realm":
		case "zone":
		case "collection":
		case "poll":
			return eq(target.kind, section);
		default:
			section satisfies never;
			return sql`false`;
	}
}
