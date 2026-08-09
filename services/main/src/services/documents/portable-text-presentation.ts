import {
	normalizePortableTextDocument,
	normalizeWikiPostPortableTextDocument,
	type PortableTextDocument,
} from "@rezics/block";
import { peekActiveObservability } from "@rezics/observability";

export type PortableTextPersistenceSource =
	| "post.body"
	| "unit_localization.content"
	| "unit_localization.description";

function recordRepair(source: PortableTextPersistenceSource): void {
	peekActiveObservability()?.metrics.persistedDocumentRepaired(source);
}

/** Isolates malformed persisted presentation data without mutating its source row. */
export function presentPortableTextDocument(
	value: unknown,
	source: PortableTextPersistenceSource,
): PortableTextDocument {
	const normalized = normalizePortableTextDocument(value);
	if (normalized.state === "repaired") recordRepair(source);
	return normalized.document;
}

export function presentNullablePortableTextDocument(
	value: unknown,
	source: PortableTextPersistenceSource,
): PortableTextDocument | null {
	return value === null ? null : presentPortableTextDocument(value, source);
}

/** Applies Wiki host policy as well as the base Portable Text normalization. */
export function presentWikiPostPortableTextDocument(
	value: unknown,
	source: PortableTextPersistenceSource,
): PortableTextDocument {
	const normalized = normalizeWikiPostPortableTextDocument(value);
	if (normalized.state === "repaired") recordRepair(source);
	return normalized.document;
}
