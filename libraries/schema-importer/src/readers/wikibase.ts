import { z } from "zod";
import { schemaId, stableJson, digest } from "@rezics/schema/identity";
const record = z.record(z.string(), z.unknown());
const snak = z
	.object({
		snaktype: z.enum(["value", "somevalue", "novalue"]),
		property: z.string().regex(/^P[1-9][0-9]*$/),
		datatype: z.string().optional(),
		datavalue: z.object({ type: z.string(), value: z.unknown() }).passthrough().optional(),
	})
	.passthrough()
	.refine(
		(value) => (value.snaktype === "value") === (value.datavalue !== undefined),
		"A value snak has exactly one datavalue",
	);

function orderedProperties(input: Record<string, unknown>, order: unknown): string[] {
	const keys = order === undefined ? Object.keys(input) : z.array(z.string()).parse(order);
	if (
		new Set(keys).size !== keys.length ||
		keys.length !== Object.keys(input).length ||
		keys.some((key) => !(key in input))
	)
		throw new TypeError("Snak property order must identify every group exactly once");
	return keys;
}
function convertSnak(value: unknown, parent: string, position: string) {
	const parsed = snak.parse(value);
	return {
		id: schemaId("wikibase-snak", parent, position),
		property: parsed.property,
		state:
			parsed.snaktype === "somevalue"
				? "unknown"
				: parsed.snaktype === "novalue"
					? "no-value"
					: "value",
		datatype: parsed.datatype ?? null,
		value: parsed.datavalue ?? null,
		raw: parsed,
	};
}
export interface WikibaseEntity {
	id: string;
	repository: string;
	externalId: string;
	type: string;
	revision: unknown;
	datatype: unknown;
	labels: unknown;
	descriptions: unknown;
	aliases: unknown;
	raw: Record<string, unknown>;
	digest: string;
	statements: {
		id: string;
		revisionId: string;
		externalId: string;
		property: string;
		rank: string;
		main: ReturnType<typeof convertSnak>;
		qualifiers: ReturnType<typeof convertSnak>[];
		references: {
			id: string;
			position: number;
			sourceHash: unknown;
			values: ReturnType<typeof convertSnak>[];
			raw: Record<string, unknown>;
		}[];
		raw: Record<string, unknown>;
	}[];
	children: WikibaseEntity[];
}
/**
 * Convert Wikibase entities to addressable statements, revision-local snaks and reference groups.
 * @alpha
 * @remarks IDs are repository-qualified and opaque; rank is not acceptance. Exact quantity/time values remain in their original datatype records.
 */
export function convertWikibase(
	input: unknown,
	repository = "https://www.wikidata.org",
): WikibaseEntity {
	return convertEntity(input, repository);
}
function convertEntity(
	input: unknown,
	repository: string,
	childType?: "form" | "sense",
): WikibaseEntity {
	const entity = record.parse(input),
		entityId = z.string().min(1).parse(entity.id),
		type = childType ?? z.string().parse(entity.type);
	if (!["item", "property", "lexeme", "form", "sense", "mediainfo"].includes(type))
		throw new TypeError(
			`Unsupported Wikibase entity type: ${type}; EntitySchema documents use the ShEx source profile`,
		);
	const identity = schemaId("wikibase-entity", repository, entityId),
		statements: WikibaseEntity["statements"] = [];
	const claims = record.parse(entity.claims ?? entity.statements ?? {});
	for (const [property, values] of Object.entries(claims))
		for (const value of z.array(record).parse(values)) {
			const externalId = z.string().min(1).parse(value.id),
				id = schemaId("wikibase-statement", repository, externalId),
				revisionId = schemaId("wikibase-statement-revision", id, digest(stableJson(value)));
			const main = convertSnak(value.mainsnak, revisionId, "main");
			if (main.property !== property)
				throw new TypeError("Statement and main snak properties disagree");
			const qualifiers: ReturnType<typeof convertSnak>[] = [],
				groups = record.parse(value.qualifiers ?? {});
			for (const key of orderedProperties(groups, value["qualifiers-order"]))
				z.array(z.unknown())
					.parse(groups[key])
					.forEach((value, i) => {
						const item = convertSnak(value, revisionId, `qualifier/${key}/${i}`);
						if (item.property !== key) throw new TypeError("Qualifier property mismatch");
						qualifiers.push(item);
					});
			const references = z
				.array(record)
				.parse(value.references ?? [])
				.map((reference, i) => {
					const referenceId = schemaId("wikibase-reference", revisionId, String(i)),
						groups = record.parse(reference.snaks);
					const values = orderedProperties(groups, reference["snaks-order"]).flatMap((key) =>
						z
							.array(z.unknown())
							.parse(groups[key])
							.map((value, j) => {
								const item = convertSnak(value, referenceId, `${key}/${j}`);
								if (item.property !== key) throw new TypeError("Reference snak property mismatch");
								return item;
							}),
					);
					return {
						id: referenceId,
						position: i,
						sourceHash: reference.hash ?? null,
						values,
						raw: reference,
					};
				});
			statements.push({
				id,
				revisionId,
				externalId,
				property,
				rank: z.enum(["preferred", "normal", "deprecated"]).parse(value.rank),
				main,
				qualifiers,
				references,
				raw: value,
			});
		}
	const children = [
		...z
			.array(record)
			.parse(entity.forms ?? [])
			.map((value) => convertEntity(value, repository, "form")),
		...z
			.array(record)
			.parse(entity.senses ?? [])
			.map((value) => convertEntity(value, repository, "sense")),
	];
	return {
		id: identity,
		repository,
		externalId: entityId,
		type,
		revision: entity.lastrevid ?? null,
		datatype: entity.datatype ?? null,
		labels: entity.labels ?? {},
		descriptions: entity.descriptions ?? {},
		aliases: entity.aliases ?? {},
		statements,
		children,
		raw: entity,
		digest: digest(stableJson(entity)),
	};
}
