import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
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

/** @internal Merge only observed changes; unchanged source assertions never overwrite independent native values. */
export function mergeCatalogSourceProfile(
	owner: "entity" | "reference",
	nativeInput: unknown,
	previous: ReturnType<typeof parseCatalogSourceProfile>,
	incoming: ReturnType<typeof parseCatalogSourceProfile>,
) {
	const before = parseCatalogSourceProfile(owner, previous.sourceProfile, previous.observedFields),
		after = parseCatalogSourceProfile(owner, incoming.sourceProfile, incoming.observedFields);
	if (before.observedFields.some((field) => !after.observedFields.includes(field)))
		throw new TypeError("Supporting update omitted a previously observed profile field");
	const native =
		owner === "entity"
			? EntityProfileSchema.parse(nativeInput)
			: ReferenceProfileSchema.parse(nativeInput);
	const desired: Record<string, unknown> = { ...native };
	const oldValues = new Map(Object.entries(before.sourceProfile)),
		newValues = new Map(Object.entries(after.sourceProfile));
	for (const field of after.observedFields) {
		const old = oldValues.get(field),
			value = newValues.get(field);
		if (before.observedFields.includes(field) && isDeepStrictEqual(old, value)) continue;
		if (!isDeepStrictEqual(desired[field], old) && !isDeepStrictEqual(desired[field], value))
			throw new TypeError(`Supporting source ${field} conflicts with an independent native edit`);
		desired[field] = value;
	}
	return owner === "entity"
		? EntityProfileSchema.parse(desired)
		: ReferenceProfileSchema.parse(desired);
}
