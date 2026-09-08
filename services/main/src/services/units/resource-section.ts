import { and, eq, inArray, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { CatalogOwnerValues, type UnitOwner } from "@rezics/reference";

export const ResourceSectionValues = [
	...CatalogOwnerValues,
	"video",
	"audio",
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
type SectionTarget = { readonly owner: SQLWrapper; readonly shape: SQLWrapper };
const DirectStudioOwners = [
	...CatalogOwnerValues,
	"video",
	"audio",
	"tag",
	"tag_path",
	"realm",
	"zone",
	"collection",
	"poll",
] as const satisfies readonly UnitOwner[];
const StudioPostShapes = ["post", "wiki", "review"] as const;

/** Resolves the product section from the actual concrete owner and native shape. */
export function resourceSectionFromReference(
	owner: UnitOwner,
	shape: string | null,
): ResourceSection | undefined {
	if (owner === "post") return StudioPostShapes.find((item) => item === shape);
	if (owner === "tag_path") return "tag";
	return ResourceSectionValues.find((section) => section === owner);
}

/** Product sections never manufacture a legacy physical subtype. */
export function resourceSectionCondition(section: ResourceSection, target: SectionTarget): SQL {
	if (section === "post" || section === "wiki" || section === "review")
		return sql`${target.owner} = 'post' and ${target.shape} = ${section}`;
	if (section === "tag") return inArray(target.owner, ["tag", "tag_path"]);
	return eq(target.owner, section);
}

/** Callers apply this predicate to a bounded source candidate page. */
export function studioResourceScopeCondition(
	section: ResourceSection | undefined,
	target: SectionTarget,
	options: { readonly includeDevelopmentPreview: boolean },
): SQL {
	if (section)
		return section === "zone" && !options.includeDevelopmentPreview
			? sql`false`
			: resourceSectionCondition(section, target);
	const owners = options.includeDevelopmentPreview
		? DirectStudioOwners
		: DirectStudioOwners.filter((owner) => owner !== "zone");
	return (
		or(
			inArray(target.owner, owners),
			and(eq(target.owner, "post"), inArray(target.shape, StudioPostShapes)),
		) ?? sql`false`
	);
}
