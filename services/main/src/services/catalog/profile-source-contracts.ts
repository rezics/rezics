import { z } from "zod";
import { EntityProfileSchema, ReferenceProfileSchema } from "./entity-contracts";

/** @internal Defaulted native fields are never implicitly claimed by a partial source observation. */
export function parseCatalogSourceProfile(
	owner: "entity" | "reference",
	input: unknown,
	fields: readonly string[],
) {
	const raw = z.record(z.string(), z.unknown()).parse(input);
	const profile =
		owner === "entity" ? EntityProfileSchema.parse(raw) : ReferenceProfileSchema.parse(raw);
	const observedFields = z.array(z.string().min(1).max(64)).max(32).parse(fields);
	if (
		new Set(observedFields).size !== observedFields.length ||
		observedFields.some((field) => !Object.hasOwn(raw, field) || !Object.hasOwn(profile, field))
	)
		throw new TypeError(
			"Source profile field scope contains an absent, duplicate or unknown native field",
		);
	const projected = Object.fromEntries(observedFields.map((field) => [field, raw[field]]));
	if (owner === "reference") projected.shape = raw.shape;
	// Defaults in unobserved positions are neutral placeholders, never copied human state.
	const sourceProfile =
		owner === "entity"
			? EntityProfileSchema.parse(projected)
			: ReferenceProfileSchema.parse(projected);
	return { sourceProfile, observedFields: [...observedFields].sort() };
}
