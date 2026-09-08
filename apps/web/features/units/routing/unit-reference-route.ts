import type { UnitReference } from "@rezics/reference";
import { publicUnitHref } from "./public-unit-route";

/** Route a logical reference by its physical owner without guessing a legacy subtype. */
export function unitReferenceHref(reference: UnitReference): string | undefined {
	switch (reference.owner) {
		case "publishing":
		case "music":
		case "program":
		case "software":
		case "entity":
		case "grouping":
		case "reference":
		case "distribution":
			return `/catalog/${reference.owner}/${reference.id}`;
		default:
			return publicUnitHref(reference.owner, { id: reference.id });
	}
}
