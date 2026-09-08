import type { DatabaseTransaction } from "../database";
import { EntityProfileSchema, ReferenceProfileSchema } from "./entity-contracts";
import { musicBrainzAreaReference, musicBrainzVocabulary } from "./musicbrainz-native";
import {
	musicBrainzArtistShape,
	musicBrainzLabelShape,
	musicBrainzLifecycle,
	type parseMusicBrainzSupportingEndpoint,
} from "./musicbrainz-entities";
import { ensureCatalogDefinition } from "./storage";
import type { recordCatalogSourceDocument } from "./source-observations";

export type MusicBrainzSupportingDocument = ReturnType<typeof parseMusicBrainzSupportingEndpoint>;
type Observation = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;

/** @internal A mapper owns only fields actually observed, plus the known source object's native class. */
export function musicBrainzSupportingObservedProfileFields(
	document: MusicBrainzSupportingDocument,
) {
	const record = document.record;
	const fields: string[] =
		document.type === "artist" || document.type === "label" || document.type === "series"
			? []
			: ["shape"];
	const observed = (native: string, ...keys: string[]) => {
		if (keys.some((key) => Object.hasOwn(record, key))) fields.push(native);
	};
	if (document.type !== "url" && document.type !== "series")
		observed("typeRevisionId", "type", "type-id");
	if (document.type === "artist") {
		observed("genderRevisionId", "gender", "gender-id");
		observed("beginAreaId", "begin-area");
		observed("endAreaId", "end-area");
	}
	if (document.type === "artist" || document.type === "label" || document.type === "place")
		observed("areaId", "area");
	if ("life-span" in record && record["life-span"])
		for (const key of ["begin", "end", "ended"])
			if (Object.hasOwn(record["life-span"], key)) fields.push(key);
	if (document.type === "place") {
		observed("address", "address");
		observed("latitude", "coordinates");
		observed("longitude", "coordinates");
	}
	if (document.type === "event") {
		observed("localTime", "time");
		observed("cancelled", "cancelled");
		observed("setlist", "setlist");
	}
	if (document.type === "url") fields.push("url");
	if (document.type === "genre" || document.type === "mood") fields.push("typeRevisionId");
	return [...new Set(fields)].sort();
}

/** @internal Determine native identity grain before initializing source children. */
export function musicBrainzSupportingTarget(document: MusicBrainzSupportingDocument) {
	if (document.type === "artist")
		return { owner: "entity", shape: musicBrainzArtistShape(document.record.type) } as const;
	if (document.type === "label")
		return { owner: "entity", shape: musicBrainzLabelShape(document.record.type) } as const;
	if (document.type === "series") return { owner: "grouping", shape: "grouping" } as const;
	return {
		owner: "reference",
		shape:
			document.type === "url"
				? "web_resource"
				: ["genre", "mood"].includes(document.type)
					? "concept"
					: document.type,
	} as const;
}

/** @internal First adoption and reviewed updates compile the same checked fixed-field profile. */
export async function musicBrainzSupportingProfile(
	tx: DatabaseTransaction,
	actor: string,
	observation: Observation,
	document: MusicBrainzSupportingDocument,
) {
	const vocabulary = (
		family: string,
		id: string | null | undefined,
		name: string | null | undefined,
		field = "type",
	) =>
		musicBrainzVocabulary(tx, family, id, name, {
			actor,
			observation,
			idPath: `/${field}-id`,
			namePath: `/${field}`,
		});
	const area = async (
		value: Parameters<typeof musicBrainzAreaReference>[3] | null | undefined,
		path: string,
	) => (value ? (await musicBrainzAreaReference(tx, actor, observation, value, path)).id : null);
	switch (document.type) {
		case "artist": {
			const record = document.record;
			return {
				owner: "entity",
				profile: EntityProfileSchema.parse({
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary("artist_type", record["type-id"], record.type),
					genderRevisionId: await vocabulary(
						"gender",
						record["gender-id"],
						record.gender,
						"gender",
					),
					areaId: await area(record.area, "/area"),
					beginAreaId: await area(record["begin-area"], "/begin-area"),
					endAreaId: await area(record["end-area"], "/end-area"),
				}),
			} as const;
		}
		case "label": {
			const record = document.record;
			return {
				owner: "entity",
				profile: EntityProfileSchema.parse({
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary("label_type", record["type-id"], record.type),
					areaId: await area(record.area, "/area"),
				}),
			} as const;
		}
		case "area": {
			const record = document.record;
			return {
				owner: "reference",
				profile: ReferenceProfileSchema.parse({
					shape: "area",
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary("area_type", record["type-id"], record.type),
				}),
			} as const;
		}
		case "place": {
			const record = document.record;
			return {
				owner: "reference",
				profile: ReferenceProfileSchema.parse({
					shape: "place",
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary("place_type", record["type-id"], record.type),
					areaId: await area(record.area, "/area"),
					address: record.address ?? null,
					latitude: record.coordinates?.latitude ?? null,
					longitude: record.coordinates?.longitude ?? null,
				}),
			} as const;
		}
		case "event": {
			const record = document.record;
			return {
				owner: "reference",
				profile: ReferenceProfileSchema.parse({
					shape: "event",
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary("event_type", record["type-id"], record.type),
					localTime: record.time || null,
					cancelled: record.cancelled ?? null,
					setlist: record.setlist ?? null,
				}),
			} as const;
		}
		case "instrument":
			return {
				owner: "reference",
				profile: ReferenceProfileSchema.parse({
					shape: "instrument",
					typeRevisionId: await vocabulary(
						"instrument_type",
						document.record["type-id"],
						document.record.type,
					),
				}),
			} as const;
		case "genre":
		case "mood": {
			const definition = await ensureCatalogDefinition(tx, {
				namespace: "musicbrainz",
				key: document.type,
				kind: "class",
				valueKind: null,
			});
			return {
				owner: "reference",
				profile: ReferenceProfileSchema.parse({
					shape: "concept",
					typeRevisionId: definition.revisionId,
				}),
			} as const;
		}
		case "url":
			return {
				owner: "reference",
				profile: ReferenceProfileSchema.parse({
					shape: "web_resource",
					url: document.record.resource,
				}),
			} as const;
		case "series":
			return null;
	}
}
