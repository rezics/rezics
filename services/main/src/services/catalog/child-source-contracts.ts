import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { CatalogPartialDateSchema } from "./contracts";
import { PublishingComponentValuesSchema } from "./publishing-components";
import { CatalogRevisionConflict } from "./storage";
import { isFractionalPosition } from "../ordering/position";

export const ChildSourceOwnerSchema = z.enum(["program", "publishing"]);
export type ChildSourceOwner = z.output<typeof ChildSourceOwnerSchema>;
const episodeOccurrence = z.strictObject({
	kind: z.literal("episode_occurrence"),
	episodeId: z.uuid(),
	position: z.string().max(512).refine(isFractionalPosition),
	sourceNumber: z.string().max(4096).nullable().default(null),
});
export const NativeChildValueSchema = z.discriminatedUnion("kind", [
	...PublishingComponentValuesSchema.options,
	episodeOccurrence,
]);
export type NativeChildValue = z.output<typeof NativeChildValueSchema>;
const id = z.uuid().nullable(),
	text = z.string().max(131072).nullable(),
	position = z.number().int().nonnegative().safe().nullable(),
	date = CatalogPartialDateSchema;
const coverage = z.strictObject({ targetId: id, position, coverageText: text });
export const ChildSourceValueSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("text_work"), fields: coverage }),
	z.strictObject({ kind: z.literal("publication_text"), fields: coverage }),
	z.strictObject({ kind: z.literal("publication_work"), fields: coverage }),
	z.strictObject({
		kind: z.literal("facet"),
		fields: z.strictObject({ definitionRevisionId: id }),
	}),
	z.strictObject({
		kind: z.literal("event"),
		fields: z.strictObject({
			publisherEntityId: id,
			publisherCredit: text,
			areaId: id,
			date,
			dateText: z.string().max(4096).nullable(),
		}),
	}),
	z.strictObject({
		kind: z.literal("installment"),
		fields: z.strictObject({
			parentId: id,
			position: z.string().max(512).refine(isFractionalPosition).nullable(),
			label: text,
			kindRevisionId: id,
			date,
			dateText: z.string().max(4096).nullable(),
		}),
	}),
	z.strictObject({
		kind: z.literal("episode_occurrence"),
		fields: z.strictObject({
			episodeId: id,
			position: z.string().max(512).refine(isFractionalPosition).nullable(),
			sourceNumber: z.string().max(4096).nullable(),
		}),
	}),
]);
export type ChildSourceValue = z.output<typeof ChildSourceValueSchema>;
export const ChildSourceComponentSchema = z.enum([
	"program_episode_occurrence",
	"publishing_text_work",
	"publishing_publication_text",
	"publishing_publication_work",
	"publishing_publication_facet",
	"publishing_release_event",
	"publishing_installment",
]);
export type ChildSourceComponent = z.output<typeof ChildSourceComponentSchema>;
export const ChildSourceComponents = {
	episode_occurrence: "program_episode_occurrence",
	text_work: "publishing_text_work",
	publication_text: "publishing_publication_text",
	publication_work: "publishing_publication_work",
	facet: "publishing_publication_facet",
	event: "publishing_release_event",
	installment: "publishing_installment",
} as const;
export const CatalogChildSourceChangeSchema = z
	.strictObject({
		kind: z.literal("catalog-child"),
		owner: ChildSourceOwnerSchema,
		ownerId: z.uuid(),
		component: ChildSourceComponentSchema,
		componentKey: z.uuid(),
		beforeRevisionId: z.uuid().nullable(),
		afterRevisionId: z.uuid(),
	})
	.refine(
		(value) =>
			value.component.startsWith(`${value.owner}_`) &&
			value.beforeRevisionId !== value.afterRevisionId,
	);
export type CatalogChildSourceChange = z.output<typeof CatalogChildSourceChangeSchema>;
export type ChildSourceProjection = { value: ChildSourceValue; observedFields: string[] };
function checkOwner(owner: ChildSourceOwner, kind: NativeChildValue["kind"]) {
	if ((owner === "program") !== (kind === "episode_occurrence"))
		throw new TypeError("Native child source belongs to another owner");
}
/** @internal Persisted source values contain only observed fields; native-only required values may remain neutral here. */
export function validateChildSourceProjection(
	owner: ChildSourceOwner,
	input: unknown,
	observedInput: unknown,
): ChildSourceProjection {
	const value = ChildSourceValueSchema.parse(input);
	checkOwner(owner, value.kind);
	const observedFields = z.array(z.string().min(1).max(96)).max(32).parse(observedInput).sort();
	if (new Set(observedFields).size !== observedFields.length)
		throw new TypeError("Duplicate observed child source field");
	const fields = z.record(z.string(), z.unknown()).parse(value.fields);
	for (const field of observedFields)
		if (!Object.hasOwn(fields, field))
			throw new TypeError("Observed child source field is outside its native contract");
	for (const [field, current] of Object.entries(fields))
		if (
			!observedFields.includes(field) &&
			!isDeepStrictEqual(current, field === "date" ? { year: null, month: null, day: null } : null)
		)
			throw new TypeError("Unobserved child source field is not neutral");
	return { value, observedFields };
}
/** @internal Native source plans are checked before their observed-only immutable interpretation is written. */
export function prepareChildSourceProjection(
	owner: ChildSourceOwner,
	input: unknown,
	observedInput: unknown,
): ChildSourceProjection {
	const native = NativeChildValueSchema.parse(input);
	checkOwner(owner, native.kind);
	const observedFields = z.array(z.string().min(1).max(96)).max(32).parse(observedInput);
	const { kind, ...fields } = native;
	return validateChildSourceProjection(
		owner,
		{
			kind,
			fields: Object.fromEntries(
				Object.entries(fields).map(([key, value]) => [
					key,
					observedFields.includes(key)
						? value
						: key === "date"
							? { year: null, month: null, day: null }
							: null,
				]),
			),
		},
		observedFields,
	);
}
/** @internal Source changes touch only observed fields and reject conflicts with independent native corrections. */
export function mergeChildSourceProjection(
	owner: ChildSourceOwner,
	before: ChildSourceProjection | null,
	after: ChildSourceProjection,
	currentInput: unknown | null,
): NativeChildValue {
	const desired = validateChildSourceProjection(owner, after.value, after.observedFields),
		previous = before
			? validateChildSourceProjection(owner, before.value, before.observedFields)
			: null;
	const current = currentInput === null ? null : NativeChildValueSchema.parse(currentInput);
	if (
		(previous && previous.value.kind !== desired.value.kind) ||
		(current && current.kind !== desired.value.kind)
	)
		throw new TypeError("Source child changes native component kind");
	if (previous?.observedFields.some((field) => !desired.observedFields.includes(field)))
		throw new TypeError(
			"Narrower child source observation requires an explicit combined projection",
		);
	const newFields = z.record(z.string(), z.unknown()).parse(desired.value.fields),
		oldFields = previous
			? z.record(z.string(), z.unknown()).parse(previous.value.fields)
			: Object.fromEntries(
					Object.keys(newFields).map((key) => [
						key,
						key === "date" ? { year: null, month: null, day: null } : null,
					]),
				);
	const fields: Record<string, unknown> = current ? { ...current } : { ...oldFields };
	delete fields.kind;
	if (!current && previous)
		throw new CatalogRevisionConflict("Source-owned child was independently removed");
	for (const field of desired.observedFields) {
		if (isDeepStrictEqual(oldFields[field], newFields[field])) continue;
		if (
			current &&
			!isDeepStrictEqual(fields[field], oldFields[field]) &&
			!isDeepStrictEqual(fields[field], newFields[field])
		)
			throw new CatalogRevisionConflict(`Source child conflicts with native ${field}`);
		fields[field] = newFields[field];
	}
	return NativeChildValueSchema.parse({ kind: desired.value.kind, ...fields });
}
