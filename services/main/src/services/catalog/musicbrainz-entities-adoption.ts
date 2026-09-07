import type { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { createEntity } from "./entities";
import { createReference, appendAreaCodes } from "./references";
import { createGrouping, assignGroupingClass } from "./grouping";
import { addCatalogIdentifier } from "./identifiers";
import {
	addCatalogName,
	ensureCatalogDefinition,
	beginCatalogFact,
	appendCatalogFactNodes,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";
import { musicBrainzAreaReference } from "./musicbrainz-native";
import { bindCatalogSourceIdentity } from "./source-bindings";
import { inspectExistingSourceBinding } from "./source-adoption";
import { recordCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import { MusicBrainzAreaSchema, musicBrainzDate } from "./musicbrainz";
import {
	musicBrainzArtistShape,
	musicBrainzLabelShape,
	musicBrainzLifecycle,
	parseMusicBrainzSupportingDocument,
} from "./musicbrainz-entities";
import { adoptMusicBrainzRelations } from "./musicbrainz-relations";

type Observation = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;

async function vocabulary(
	tx: DatabaseTransaction,
	family: string,
	id: string | null | undefined,
	name: string | null | undefined,
) {
	const key = id || name;
	if (!key) return null;
	return (
		await ensureCatalogDefinition(tx, {
			namespace: `musicbrainz.${family}`,
			key,
			kind: "vocabulary",
			valueKind: null,
		})
	).revisionId;
}

async function areaReference(
	tx: DatabaseTransaction,
	actor: string,
	observation: Observation,
	area: z.infer<typeof MusicBrainzAreaSchema> | null | undefined,
	path: string,
) {
	if (!area) return null;
	const identity = await musicBrainzAreaReference(tx, actor, observation, area, path);
	return identity.id;
}

async function areaCodes(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	initialRevision: number,
	record: z.infer<typeof MusicBrainzAreaSchema>,
) {
	let revision = initialRevision;
	for (const [namespace, codes] of [
		["iso-3166-1", record["iso-3166-1-codes"]],
		["iso-3166-2", record["iso-3166-2-codes"]],
		["iso-3166-3", record["iso-3166-3-codes"]],
	] as const) {
		const values = [...new Set(codes ?? [])].map((code) => ({ namespace, code }));
		for (let offset = 0; offset < values.length; offset += 128)
			revision = (
				await appendAreaCodes(tx, reference, actor, revision, values.slice(offset, offset + 128))
			).revision;
	}
	return revision;
}

async function textFact(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	revision: number,
	observation: Observation,
	key: string,
	value: string | null | undefined,
	path: string,
) {
	if (!value) return revision;
	const definition = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key,
		kind: "property",
		valueKind: "string",
	});
	const fact = await beginCatalogFact(tx, reference, actor, revision, definition.revisionId);
	const appended = await appendCatalogFactNodes(tx, reference, actor, fact.revision, fact.id, -1, [
		...catalogValueNodes(value),
	]);
	const sealed = await sealCatalogFact(
		tx,
		reference,
		actor,
		appended.revision,
		fact.id,
		appended.lastNodePosition,
	);
	await tx.insert(CatalogFactTables[reference.owner].support).values({
		ownerId: reference.id,
		factId: fact.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: path,
	});
	return sealed.revision;
}

/**
 * Admit a bounded checked supporting endpoint through the same native commands as manual authorship.
 * @alpha
 * @remarks Replays are idempotent; changed source snapshots require review and never overwrite local edits.
 * Work and memory are bounded by one 8 MB document (8,192 aliases/relations), not corpus cardinality.
 */
export async function adoptMusicBrainzSupportingEndpoint(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	const parsed = parseMusicBrainzSupportingDocument(receipt, bytes);
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		`musicbrainz.${parsed.type}.1`,
	);
	if (existing) return existing;
	const name = {
		languageTag: null,
		value: parsed.type === "url" ? parsed.record.resource : parsed.record.name,
	};
	let identity: CatalogReference & { revision: number; nameId: string };
	switch (parsed.type) {
		case "artist": {
			const record = parsed.record;
			identity = await createEntity(tx, actor, {
				name,
				shape: musicBrainzArtistShape(record.type),
				profile: {
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary(tx, "artist_type", record["type-id"], record.type),
					genderRevisionId: await vocabulary(tx, "gender", record["gender-id"], record.gender),
					areaId: await areaReference(tx, actor, observation, record.area, "/area"),
					beginAreaId: await areaReference(
						tx,
						actor,
						observation,
						record["begin-area"],
						"/begin-area",
					),
					endAreaId: await areaReference(tx, actor, observation, record["end-area"], "/end-area"),
				},
			});
			break;
		}
		case "label": {
			const record = parsed.record;
			identity = await createEntity(tx, actor, {
				name,
				shape: musicBrainzLabelShape(record.type),
				profile: {
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary(tx, "label_type", record["type-id"], record.type),
					areaId: await areaReference(tx, actor, observation, record.area, "/area"),
				},
			});
			break;
		}
		case "area": {
			const record = parsed.record;
			identity = await createReference(tx, actor, {
				name,
				profile: {
					shape: "area",
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary(tx, "area_type", record["type-id"], record.type),
				},
			});
			identity.revision = await areaCodes(tx, actor, identity, identity.revision, record);
			break;
		}
		case "place": {
			const record = parsed.record;
			identity = await createReference(tx, actor, {
				name,
				profile: {
					shape: "place",
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary(tx, "place_type", record["type-id"], record.type),
					areaId: await areaReference(tx, actor, observation, record.area, "/area"),
					address: record.address ?? null,
					latitude: record.coordinates?.latitude ?? null,
					longitude: record.coordinates?.longitude ?? null,
				},
			});
			break;
		}
		case "event": {
			const record = parsed.record;
			identity = await createReference(tx, actor, {
				name,
				profile: {
					shape: "event",
					...musicBrainzLifecycle(record["life-span"]),
					typeRevisionId: await vocabulary(tx, "event_type", record["type-id"], record.type),
					localTime: record.time || null,
					cancelled: record.cancelled ?? null,
					setlist: record.setlist ?? null,
				},
			});
			break;
		}
		case "instrument": {
			const record = parsed.record;
			identity = await createReference(tx, actor, {
				name,
				profile: {
					shape: "instrument",
					typeRevisionId: await vocabulary(tx, "instrument_type", record["type-id"], record.type),
				},
			});
			break;
		}
		case "series": {
			identity = await createGrouping(tx, actor, { name });
			const type = await ensureCatalogDefinition(tx, {
				namespace: "catalog",
				key: "series",
				kind: "class",
				valueKind: null,
			});
			identity.revision = (
				await assignGroupingClass(tx, identity, actor, identity.revision, type.revisionId)
			).revision;
			const sourceType = parsed.record["type-id"] || parsed.record.type;
			if (sourceType) {
				const classification = await ensureCatalogDefinition(tx, {
					namespace: "musicbrainz.series_type",
					key: sourceType,
					kind: "class",
					valueKind: null,
				});
				identity.revision = (
					await assignGroupingClass(
						tx,
						identity,
						actor,
						identity.revision,
						classification.revisionId,
					)
				).revision;
			}
			break;
		}
		case "genre":
		case "mood": {
			const definition = await ensureCatalogDefinition(tx, {
				namespace: "musicbrainz",
				key: parsed.type,
				kind: "class",
				valueKind: null,
			});
			identity = await createReference(tx, actor, {
				name,
				profile: { shape: "concept", typeRevisionId: definition.revisionId },
			});
			break;
		}
		case "url":
			identity = await createReference(tx, actor, {
				name,
				profile: { shape: "web_resource", url: parsed.record.resource },
			});
			break;
	}
	let revision = identity.revision;
	const support = CatalogFactTables[identity.owner].support;
	await tx.insert(support).values({
		ownerId: identity.id,
		namedFormId: identity.nameId,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: parsed.type === "url" ? "/resource" : "/name",
	});
	const identifier = async (namespace: string, value: string, path: string) => {
		const added = await addCatalogIdentifier(tx, identity, actor, revision, { namespace, value });
		revision = added.revision;
		await tx.insert(support).values({
			ownerId: identity.id,
			identifierId: added.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: path,
		});
	};
	await identifier(`musicbrainz.${parsed.type}`, parsed.record.id, "/id");
	if (parsed.type !== "url") {
		const record = parsed.record;
		if (record["sort-name"]) {
			const added = await addCatalogName(tx, identity, actor, revision, {
				kind: "sort",
				value: record["sort-name"],
				languageTag: null,
			});
			revision = added.revision;
			await tx.insert(support).values({
				ownerId: identity.id,
				namedFormId: added.id,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: "/sort-name",
			});
		}
		for (const [index, alias] of (record.aliases ?? []).entries()) {
			const added = await addCatalogName(tx, identity, actor, revision, {
				kind:
					alias.type === "Search hint"
						? "search-hint"
						: alias.type === "Legal name"
							? "legal"
							: "alias",
				value: alias.name,
				languageTag: alias.locale?.replaceAll("_", "-") || null,
				sortName: alias["sort-name"] || null,
				primaryForLanguage: alias.primary ?? null,
				begin: alias.begin ? musicBrainzDate(alias.begin) : null,
				end: alias.end ? musicBrainzDate(alias.end) : null,
				ended: alias.ended ?? null,
			});
			revision = added.revision;
			await tx.insert(support).values({
				ownerId: identity.id,
				namedFormId: added.id,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: `/aliases/${index}`,
			});
		}
		revision = await textFact(
			tx,
			actor,
			identity,
			revision,
			observation,
			"disambiguation",
			record.disambiguation,
			"/disambiguation",
		);
		revision = await textFact(
			tx,
			actor,
			identity,
			revision,
			observation,
			"annotation",
			record.annotation,
			"/annotation",
		);
	}
	if (parsed.type === "artist" || parsed.type === "label") {
		for (const [index, value] of (parsed.record.ipis ?? []).entries())
			await identifier("ipi", value, `/ipis/${index}`);
		for (const [index, value] of (parsed.record.isnis ?? []).entries())
			await identifier("isni", value, `/isnis/${index}`);
		if (parsed.record.country)
			revision = await textFact(
				tx,
				actor,
				identity,
				revision,
				observation,
				"country_of_association",
				parsed.record.country,
				"/country",
			);
		if (parsed.type === "label" && parsed.record["label-code"] != null)
			await identifier("label-code", String(parsed.record["label-code"]), "/label-code");
	}
	if (parsed.type === "instrument" || parsed.type === "genre" || parsed.type === "mood")
		revision = await textFact(
			tx,
			actor,
			identity,
			revision,
			observation,
			"description",
			parsed.record.description,
			"/description",
		);
	if (parsed.type === "series")
		revision = await textFact(
			tx,
			actor,
			identity,
			revision,
			observation,
			"series.ordering_method",
			parsed.record["ordering-type"],
			"/ordering-type",
		);
	revision = await adoptMusicBrainzRelations(
		tx,
		actor,
		identity,
		revision,
		observation,
		parsed.record.relations ?? [],
	);
	await bindCatalogSourceIdentity(tx, actor, {
		sourceRecordId: observation.record.id,
		path: "/",
		snapshotId: observation.snapshot.id,
		reference: { owner: identity.owner, id: identity.id },
	});
	return {
		status: "created" as const,
		reference: { owner: identity.owner, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}
