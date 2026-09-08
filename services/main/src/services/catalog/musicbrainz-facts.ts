import { z } from "zod";
import { musicBrainzDate } from "./musicbrainz";
import { applyCatalogSourceFactDelta, type CatalogSourceFactDescriptor } from "./source-fact-delta";

const schema = z.object({
	annotation: z.string().max(131072).nullable().optional(),
	disambiguation: z.string().max(131072).nullable().optional(),
	description: z.string().max(131072).nullable().optional(),
	country: z.string().max(131072).nullable().optional(),
	"ordering-type": z.string().max(131072).nullable().optional(),
	"first-release-date": z.string().optional(),
	attributes: z
		.array(
			z.object({
				type: z.string(),
				"type-id": z.uuid().nullable().optional(),
				value: z.string().max(131072),
			}),
		)
		.max(8192)
		.optional(),
});
type RecordFacts = z.input<typeof schema>;
type Descriptor = CatalogSourceFactDescriptor;

/** @internal These are provider-independent text/date assertions; source-local work-attribute types retain reviewed identity. */
export function musicBrainzFactDescriptors(input: RecordFacts): Descriptor[] {
	const record = schema.parse(input);
	const result: Descriptor[] = [];
	for (const key of ["annotation", "disambiguation", "description"] as const)
		if (record[key])
			result.push({
				identity: key,
				path: `/${key}`,
				namespace: "catalog",
				key,
				value: record[key],
				kind: "string",
			});
	for (const [field, key] of [
		["country", "country_of_association"],
		["ordering-type", "series.ordering_method"],
	] as const)
		if (record[field])
			result.push({
				identity: key,
				path: `/${field}`,
				namespace: "catalog",
				key,
				value: record[field],
				kind: "string",
			});
	if (record["first-release-date"])
		result.push({
			identity: "first-issued-date",
			path: "/first-release-date",
			namespace: "catalog",
			key: "first-issued-date",
			value: musicBrainzDate(record["first-release-date"]),
			kind: "object",
		});
	for (const [index, attribute] of (record.attributes ?? []).entries())
		result.push({
			identity: `work-attribute:${attribute["type-id"] ?? attribute.type}`,
			path: `/attributes/${index}`,
			namespace: "musicbrainz.work_attribute",
			key: attribute["type-id"] ?? attribute.type,
			value: attribute.value,
			kind: "string",
		});
	return result;
}

/** @internal MusicBrainz interpretation feeds the provider-independent exact source fact journal. */
export async function applyMusicBrainzFactDelta(
	tx: Parameters<typeof applyCatalogSourceFactDelta>[0],
	reference: Parameters<typeof applyCatalogSourceFactDelta>[1],
	actor: string,
	revision: number,
	observation: Parameters<typeof applyCatalogSourceFactDelta>[4],
	previous: { snapshotId: string; mappingKey: string; record: RecordFacts } | null,
	incoming: RecordFacts,
) {
	return applyCatalogSourceFactDelta(
		tx,
		reference,
		actor,
		revision,
		observation,
		previous
			? {
					snapshotId: previous.snapshotId,
					mappingKey: previous.mappingKey,
					descriptors: musicBrainzFactDescriptors(previous.record),
				}
			: null,
		musicBrainzFactDescriptors(incoming),
	);
}
