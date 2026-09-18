import { z } from "zod";
import { ProgramStructureSchema } from "./program";
import { PublishingStructureSchema } from "./publishing";

export const StructureSourceOwnerSchema = z.enum(["program", "publishing"]);
export type StructureSourceOwner = z.output<typeof StructureSourceOwnerSchema>;
import { StructureSourceComponentSchema, type StructureSourceComponent, type StructureSourceValue } from "@rezics/schema/contracts/native/source-values";
export { StructureSourceComponentSchema, type StructureSourceComponent, type StructureSourceValue };
export type StructureSourceProjection = { value: StructureSourceValue; observedFields: string[] };
export const CatalogStructureSourceChangeSchema = z
	.strictObject({
		kind: z.literal("catalog-structure"),
		owner: StructureSourceOwnerSchema,
		ownerId: z.uuid(),
		component: StructureSourceComponentSchema,
		componentKey: z.uuid(),
		beforeRevisionId: z.uuid(),
		afterRevisionId: z.uuid(),
	})
	.refine(
		(value) =>
			value.component.startsWith(`${value.owner}_`) &&
			value.componentKey === value.ownerId &&
			value.beforeRevisionId !== value.afterRevisionId,
		"Structure journal scope or history identity differs",
	);
export type CatalogStructureSourceChange = z.output<typeof CatalogStructureSourceChangeSchema>;

/** @internal Only source-observed fields enter immutable interpretation; unobserved native values stay neutral. */
export function prepareStructureSourceProjection(
	owner: StructureSourceOwner,
	input: unknown,
	observedFields: unknown,
): StructureSourceProjection {
	const value =
		owner === "program"
			? ProgramStructureSchema.parse(input)
			: PublishingStructureSchema.parse(input);
	const observed = z.array(z.string().min(1).max(96)).max(32).parse(observedFields).sort();
	if (new Set(observed).size !== observed.length)
		throw new TypeError("Duplicate observed structure field");
	const source = z.record(z.string(), z.unknown()).parse(value.fields);
	const neutral =
		owner === "program"
			? ProgramStructureSchema.parse({ shape: value.shape, fields: {} })
			: PublishingStructureSchema.parse({ shape: value.shape, fields: {} });
	const fields: Record<string, unknown> = { ...neutral.fields };
	for (const key of observed) {
		if (!Object.hasOwn(source, key))
			throw new TypeError("Observed field is outside the native structure contract");
		fields[key] = source[key];
	}
	const projected = { shape: value.shape, fields };
	return {
		value:
			owner === "program"
				? ProgramStructureSchema.parse(projected)
				: PublishingStructureSchema.parse(projected),
		observedFields: observed,
	};
}

/** @internal Native physical history components are fixed by the owning structural shape. */
export function structureSourceComponent(
	owner: StructureSourceOwner,
	input: unknown,
): StructureSourceComponent {
	if (owner === "program") {
		const value = ProgramStructureSchema.parse(input);
		return (
			{
				program: "program_work",
				season: "program_season",
				program_version: "program_version",
				episode: "program_episode",
			} as const
		)[value.shape];
	}
	const value = PublishingStructureSchema.parse(input);
	return (
		{
			work: "publishing_work",
			text_version: "publishing_text_version",
			publication: "publishing_publication",
			serialization: "publishing_serialization",
		} as const
	)[value.shape];
}
