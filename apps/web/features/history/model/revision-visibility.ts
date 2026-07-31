import type {
	GetApiHistoryUnitsByUnitIdRevisionsStatus200,
	PatchApiHistoryUnitRevisionsByRevisionIdVisibilityBody,
} from "@rezics/openapi-tanstack-query";

export type UnitRevision = GetApiHistoryUnitsByUnitIdRevisionsStatus200["items"][number];
export type UnitRevisionVisibility = UnitRevision["visibility"];
export type UnitRevisionVisibilityKind = UnitRevisionVisibility["kind"];
export type UnitRevisionHiddenField = Extract<
	UnitRevisionVisibility,
	{ kind: "hidden" | "suppressed" }
>["hiddenFields"][number];
export type UnitRevisionVisibilityCapabilities =
	GetApiHistoryUnitsByUnitIdRevisionsStatus200["capabilities"];
export type RevisionVisibilityMutationBody = PatchApiHistoryUnitRevisionsByRevisionIdVisibilityBody;

export const UnitRevisionVisibilityKinds = [
	"visible",
	"hidden",
	"suppressed",
] as const satisfies readonly UnitRevisionVisibilityKind[];

export const UnitRevisionHiddenFields = [
	"content",
	"summary",
	"actor",
] as const satisfies readonly UnitRevisionHiddenField[];

export function canSetRevisionVisibility(
	current: UnitRevisionVisibilityKind,
	next: UnitRevisionVisibilityKind,
	capabilities: UnitRevisionVisibilityCapabilities,
): boolean {
	return current === "suppressed" || next === "suppressed"
		? capabilities.canSuppress
		: capabilities.canModerate;
}

export function isRevisionFieldHidden(
	visibility: UnitRevisionVisibility,
	field: UnitRevisionHiddenField,
): boolean {
	return visibility.kind !== "visible" && visibility.hiddenFields.includes(field);
}

export function canViewRevisionField(
	visibility: UnitRevisionVisibility,
	field: UnitRevisionHiddenField,
	capabilities: UnitRevisionVisibilityCapabilities,
): boolean {
	if (!isRevisionFieldHidden(visibility, field)) return true;
	return visibility.kind === "suppressed" ? capabilities.canSuppress : capabilities.canModerate;
}

export function revisionHiddenFields(
	visibility: UnitRevisionVisibility,
): UnitRevisionHiddenField[] {
	return visibility.kind === "visible" ? [] : [...visibility.hiddenFields];
}

export function revisionVisibilitiesEqual(
	left: UnitRevisionVisibility,
	right: UnitRevisionVisibility,
): boolean {
	if (left.kind !== right.kind) return false;
	if (left.kind === "visible" || right.kind === "visible") return true;
	return (
		left.hiddenFields.length === right.hiddenFields.length &&
		left.hiddenFields.every((field) => right.hiddenFields.includes(field))
	);
}

export function buildRevisionVisibility(
	kind: UnitRevisionVisibilityKind,
	hiddenFields: readonly UnitRevisionHiddenField[],
): UnitRevisionVisibility | null {
	if (kind === "visible") return { kind };
	const uniqueFields = [...new Set(hiddenFields)];
	return uniqueFields.length > 0 ? { kind, hiddenFields: uniqueFields } : null;
}
