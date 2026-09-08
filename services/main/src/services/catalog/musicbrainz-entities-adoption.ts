import { catalogSourceSupportColumns } from "./source-support";
import type { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { initializeEntityProfile, resolveEntityShape } from "./entities";
import { initializeReferenceProfile, appendAreaCodes } from "./references";
import { assignGroupingClass } from "./grouping";
import { addCatalogIdentifier } from "./identifiers";
import {
	addCatalogName,
	createCatalogIdentity,
	loadCatalogIdentity,
	ensureCatalogDefinition,
	beginCatalogFact,
	appendCatalogFactNodes,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";
import {
	musicBrainzSupportingTarget,
	musicBrainzSupportingProfile,
	musicBrainzSupportingObservedProfileFields,
} from "./musicbrainz-supporting-profile";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { bindCatalogProfileSourceOccurrence } from "./profile-source";
import { bindCatalogNameSourceOccurrence } from "./names";
import { inspectExistingSourceBinding } from "./source-adoption";
import { recordCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import { MusicBrainzAreaSchema } from "./musicbrainz";
import { adoptMusicBrainzAliases } from "./musicbrainz-names";
import { parseMusicBrainzSupportingDocument } from "./musicbrainz-entities";
import { adoptMusicBrainzRelations } from "./musicbrainz-relations";

type Observation = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;

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
		...(await catalogSourceSupportColumns(tx, observation.record.id)),
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
	if (existing && existing.status !== "initialize_reference") return existing;
	const target = musicBrainzSupportingTarget(parsed);
	const root = existing
		? { ...existing.reference, revision: existing.revision }
		: await createCatalogIdentity(tx, target, actor);
	const current = await loadCatalogIdentity(tx, root, actor, true);
	if (
		root.owner !== target.owner ||
		(current.shape !== target.shape &&
			!(
				root.owner === "entity" &&
				(current.shape === "unresolved" || target.shape === "unresolved")
			))
	)
		throw new TypeError("Supporting endpoint requires reviewed native reclassification");
	await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		reference: root,
		mappingVersion: `musicbrainz.${parsed.type}.1`,
	});
	if (
		root.owner === "entity" &&
		current.shape === "unresolved" &&
		target.owner === "entity" &&
		target.shape !== "unresolved"
	)
		root.revision = (
			await resolveEntityShape(tx, root, actor, root.revision, target.shape)
		).revision;
	const profile = await musicBrainzSupportingProfile(tx, actor, observation, parsed);
	if (profile) {
		const initialized =
			profile.owner === "entity"
				? await initializeEntityProfile(tx, root, actor, root.revision, profile.profile)
				: await initializeReferenceProfile(tx, root, actor, root.revision, profile.profile);
		root.revision = initialized.revision;
		await bindCatalogProfileSourceOccurrence(tx, root, actor, {
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: "/",
			revision: initialized.revision,
			sourceProfile: profile.profile,
			observedFields: musicBrainzSupportingObservedProfileFields(parsed),
		});
	}
	if (parsed.type === "area")
		root.revision = await areaCodes(tx, actor, root, root.revision, parsed.record);
	if (parsed.type === "series") {
		const base = await ensureCatalogDefinition(tx, {
			namespace: "catalog",
			key: "series",
			kind: "class",
			valueKind: null,
		});
		root.revision = (
			await assignGroupingClass(tx, root, actor, root.revision, base.revisionId)
		).revision;
		const sourceType = parsed.record["type-id"] || parsed.record.type;
		if (sourceType) {
			const definition = await ensureCatalogDefinition(tx, {
				namespace: "musicbrainz.series_type",
				key: sourceType,
				kind: "class",
				valueKind: null,
			});
			root.revision = (
				await assignGroupingClass(tx, root, actor, root.revision, definition.revisionId)
			).revision;
		}
	}
	const named = await addCatalogName(tx, root, actor, root.revision, {
		kind: "source-primary",
		languageTag: null,
		value: parsed.type === "url" ? parsed.record.resource : parsed.record.name,
	});
	const identity = { ...root, revision: named.revision, nameId: named.id };
	await bindCatalogNameSourceOccurrence(tx, identity, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		namespace: "musicbrainz.name",
		localKey: "primary",
		sourcePath: parsed.type === "url" ? "/resource" : "/name",
		nameId: named.id,
		nameRevision: named.nameRevision,
	});

	let revision = identity.revision;
	const support = CatalogFactTables[identity.owner].support;
	await tx.insert(support).values({
		...(await catalogSourceSupportColumns(tx, observation.record.id)),
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
			...(await catalogSourceSupportColumns(tx, observation.record.id)),
			ownerId: identity.id,
			identifierId: added.id,
			identifierRevision: added.identifierRevision,
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
			await bindCatalogNameSourceOccurrence(tx, identity, actor, {
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				namespace: "musicbrainz.name",
				localKey: "sort",
				sourcePath: "/sort-name",
				nameId: added.id,
				nameRevision: added.nameRevision,
			});
			await tx.insert(support).values({
				...(await catalogSourceSupportColumns(tx, observation.record.id)),
				ownerId: identity.id,
				namedFormId: added.id,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: "/sort-name",
			});
		}
		revision = await adoptMusicBrainzAliases(
			tx,
			actor,
			identity,
			revision,
			observation,
			record.aliases ?? [],
		);
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
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference: identity,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
			mappingVersion: `musicbrainz.${parsed.type}.1`,
		});
	else
		await sealCatalogSourceChildCorrespondence(tx, actor, {
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
