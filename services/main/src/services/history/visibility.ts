export const RevisionHiddenFieldValues = ["content", "summary", "actor"] as const;
export type RevisionHiddenField = (typeof RevisionHiddenFieldValues)[number];

type RestrictedRevisionVisibility = {
	readonly kind: "hidden" | "suppressed";
	readonly hiddenFields: [RevisionHiddenField, ...RevisionHiddenField[]];
};

export type RevisionVisibility = { readonly kind: "visible" } | RestrictedRevisionVisibility;

export type StoredRevisionVisibility = {
	readonly contentHidden: boolean;
	readonly summaryHidden: boolean;
	readonly actorHidden: boolean;
	readonly suppressed: boolean;
};

export type RevisionVisibilityAccess = {
	readonly moderate: boolean;
	readonly suppress: boolean;
};

export function createRevisionVisibility(
	kind: RevisionVisibility["kind"],
	hiddenFields: readonly RevisionHiddenField[],
): RevisionVisibility {
	if (kind === "visible") return { kind };
	const [first, ...rest] = hiddenFields;
	if (!first) throw new TypeError("A restricted revision must hide at least one field");
	if (new Set(hiddenFields).size !== hiddenFields.length)
		throw new TypeError("A revision field cannot be hidden more than once");
	return { kind, hiddenFields: [first, ...rest] };
}

export function revisionVisibilityFromStorage(input: StoredRevisionVisibility): RevisionVisibility {
	const hiddenFields: RevisionHiddenField[] = [];
	if (input.contentHidden) hiddenFields.push("content");
	if (input.summaryHidden) hiddenFields.push("summary");
	if (input.actorHidden) hiddenFields.push("actor");
	if (hiddenFields.length === 0) {
		if (input.suppressed)
			throw new TypeError("A suppressed revision must hide at least one field");
		return { kind: "visible" };
	}
	return createRevisionVisibility(input.suppressed ? "suppressed" : "hidden", hiddenFields);
}

export function revisionVisibilityToStorage(
	visibility: RevisionVisibility,
): StoredRevisionVisibility {
	const hiddenFields = new Set(visibility.kind === "visible" ? [] : visibility.hiddenFields);
	return {
		contentHidden: hiddenFields.has("content"),
		summaryHidden: hiddenFields.has("summary"),
		actorHidden: hiddenFields.has("actor"),
		suppressed: visibility.kind === "suppressed",
	};
}

export function revisionVisibilitiesEqual(
	left: RevisionVisibility,
	right: RevisionVisibility,
): boolean {
	if (left.kind !== right.kind) return false;
	if (left.kind === "visible" || right.kind === "visible") return true;
	return (
		left.hiddenFields.length === right.hiddenFields.length &&
		left.hiddenFields.every((field) => right.hiddenFields.includes(field))
	);
}

export function canViewRestrictedRevisionFields(
	visibility: RevisionVisibility,
	access: RevisionVisibilityAccess,
): boolean {
	if (visibility.kind === "visible") return true;
	return visibility.kind === "suppressed" ? access.suppress : access.moderate;
}

export function canViewRevisionField(
	visibility: RevisionVisibility,
	field: RevisionHiddenField,
	access: RevisionVisibilityAccess,
): boolean {
	return (
		visibility.kind === "visible" ||
		!visibility.hiddenFields.includes(field) ||
		canViewRestrictedRevisionFields(visibility, access)
	);
}

export function requiredRevisionVisibilityCapability(
	current: RevisionVisibility,
	next: RevisionVisibility,
): "platform.moderate" | "platform.suppress" {
	return current.kind === "suppressed" || next.kind === "suppressed"
		? "platform.suppress"
		: "platform.moderate";
}
