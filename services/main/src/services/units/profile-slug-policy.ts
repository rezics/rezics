import { isProfileSlugReserved, TopLevelSlugNamespaceUnitIds, type SlugLabel } from "@rezics/slug";

import { ProfileSlugChangeUnavailable, SlugReserved } from "./errors";
import { parseSlugLabel } from "./slug";

export type ProfileSlugAssignmentDecision = "assign" | "unchanged";

/**
 * Parses a label accepted by temporary Profile self-service governance.
 *
 * @remarks
 * Reserved labels are a removable product policy rather than a storage
 * invariant. Platform-governed address operations deliberately use the
 * underlying slug parser instead.
 *
 * @alpha
 */
export function parseAssignableProfileSlug(value: string): SlugLabel {
	const slug = parseSlugLabel(value);
	if (isProfileSlugReserved(slug)) throw new SlugReserved(slug);
	return slug;
}

/**
 * Decides whether the temporary self-service command may assign a Profile slug.
 *
 * @remarks
 * The one-time rule is intentionally enforced here and in the service
 * transaction, not by a database constraint. A later product release may
 * replace this governance rule with an audited rename lifecycle.
 *
 * @alpha
 */
export function decideProfileSlugAssignment(
	current: { readonly scopeUnitId: string | null; readonly slug: SlugLabel } | null,
	requestedSlug: SlugLabel,
): ProfileSlugAssignmentDecision {
	if (!current) return "assign";
	if (current.scopeUnitId === TopLevelSlugNamespaceUnitIds.users && current.slug === requestedSlug)
		return "unchanged";
	throw new ProfileSlugChangeUnavailable();
}
