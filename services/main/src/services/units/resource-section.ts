import { and, eq, exists, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { database } from "../database";
import { post } from "../database/schema";
import type { PostKind, UnitKind } from "../database/schema/contract-values";

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
type StudioScopeTarget = SectionTarget & { readonly postKind?: AnyPgColumn };

const DirectStudioUnitKinds = [
	"book",
	"software",
	"media",
	"entity",
	"tag",
	"tag_path",
	"realm",
	"zone",
	"collection",
	"poll",
] as const satisfies readonly UnitKind[];

const StudioPostKinds = ["post", "wiki", "review"] as const satisfies readonly PostKind[];

/** Resolves the canonical Studio section after persisted discriminators are validated. */
export function resourceSectionFromKinds(
	unitKind: UnitKind,
	postKind: PostKind | null,
): ResourceSection | undefined {
	switch (unitKind) {
		case "book":
		case "software":
		case "media":
		case "entity":
		case "realm":
		case "zone":
		case "collection":
		case "poll":
			return unitKind;
		case "tag":
		case "tag_path":
			return "tag";
		case "post":
			return StudioPostKinds.find((kind) => kind === postKind);
		default:
			return undefined;
	}
}

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
		case "realm":
		case "zone":
		case "collection":
		case "poll":
			return eq(target.kind, section);
		case "tag":
			return inArray(target.kind, ["tag", "tag_path"]);
		default:
			section satisfies never;
			return sql`false`;
	}
}

/**
 * Bounds aggregate Studio reads to supported resources and hides preview-only Zones by default.
 */
export function studioResourceScopeCondition(
	section: ResourceSection | undefined,
	target: StudioScopeTarget,
	options: { readonly includeDevelopmentPreview: boolean },
): SQL {
	if (section) {
		if (target.postKind && (section === "post" || section === "review" || section === "wiki"))
			return and(eq(target.kind, "post"), eq(target.postKind, section)) as SQL;
		return section === "zone" && !options.includeDevelopmentPreview
			? sql`false`
			: resourceSectionCondition(section, target);
	}
	const directKinds = options.includeDevelopmentPreview
		? DirectStudioUnitKinds
		: DirectStudioUnitKinds.filter((kind) => kind !== "zone");
	return or(
		inArray(target.kind, directKinds),
		and(
			eq(target.kind, "post"),
			target.postKind
				? inArray(target.postKind, StudioPostKinds)
				: exists(
						database
							.select({ id: post.id })
							.from(post)
							.where(and(eq(post.id, target.id), inArray(post.kind, StudioPostKinds))),
					),
		),
	) as SQL;
}
