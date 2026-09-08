import { isDeepStrictEqual } from "node:util";
import { runParticipationSavepoint } from "../participation/policy";
import { EntityProfileSchema, ReferenceProfileSchema } from "./entity-contracts";
import { parseCatalogSourceProfile, mergeCatalogSourceProfile } from "./profile-source-contracts";
import { parseMusicBrainzSupportingDocument } from "./musicbrainz-entities";
import {
	musicBrainzSupportingTarget,
	musicBrainzSupportingProfile,
	musicBrainzSupportingObservedProfileFields,
	type MusicBrainzSupportingDocument,
} from "./musicbrainz-supporting-profile";
import { loadCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import type { CatalogSourceNativeChange } from "./source-applications";
import {
	readCatalogSourceProfile,
	readCatalogProfileHead,
	writeCatalogSourceProfile,
	bindCatalogProfileSourceOccurrence,
} from "./profile-source";
import { CatalogRevisionConflict, loadCatalogIdentity, recordCatalogChange } from "./storage";
import { applyMusicBrainzNameDelta } from "./musicbrainz-name-delta";
import { applyMusicBrainzFactDelta } from "./musicbrainz-facts";
import {
	applyMusicBrainzIdentifierDelta,
	type MusicBrainzIdentifierDescriptor,
} from "./musicbrainz-identifier-delta";
import { compensateMusicSourceApplication } from "./music-source-compensation";
import { applyMusicBrainzRelationDelta } from "./musicbrainz-relation-delta";

type Archive = { receipt: CatalogSourceReceipt; bytes: Uint8Array };
function names(document: MusicBrainzSupportingDocument) {
	return document.type === "url"
		? { title: document.record.resource }
		: {
				title: document.record.name,
				aliases: document.record.aliases,
				"sort-name": document.record["sort-name"],
			};
}
function identifiers(document: MusicBrainzSupportingDocument): MusicBrainzIdentifierDescriptor[] {
	if (document.type !== "artist" && document.type !== "label") return [];
	const result = [
		...(document.record.ipis ?? []).map((value, index) => ({
			namespace: "ipi",
			value,
			path: `/ipis/${index}`,
		})),
		...(document.record.isnis ?? []).map((value, index) => ({
			namespace: "isni",
			value,
			path: `/isnis/${index}`,
		})),
	];
	if (document.type === "label" && document.record["label-code"] != null)
		result.push({
			namespace: "label-code",
			value: String(document.record["label-code"]),
			path: "/label-code",
		});
	return result;
}
function facts(document: MusicBrainzSupportingDocument) {
	if (document.type === "url") return {};
	return {
		annotation: document.record.annotation,
		disambiguation: document.record.disambiguation,
		description:
			document.type === "instrument" || document.type === "genre" || document.type === "mood"
				? document.record.description
				: undefined,
		country:
			document.type === "artist" || document.type === "label" ? document.record.country : undefined,
		"ordering-type": document.type === "series" ? document.record["ordering-type"] : undefined,
	};
}

/** @internal Supporting endpoints apply fixed profiles, named forms, text assertions and identifier claims through native writers. */
export function musicBrainzSupportingNativeWriter(
	beforeArchive: Archive,
	afterArchive: Archive,
): CatalogSourceNativeWriter {
	return (outer, context) =>
		runParticipationSavepoint(outer, async (tx) => {
			if (context.action === "withdraw") return compensateMusicSourceApplication(tx, context);
			if (!context.previousSnapshotId)
				throw new TypeError("Supporting update requires a persisted previous interpretation");
			const before = parseMusicBrainzSupportingDocument(beforeArchive.receipt, beforeArchive.bytes),
				after = parseMusicBrainzSupportingDocument(afterArchive.receipt, afterArchive.bytes);
			if (
				before.type !== after.type ||
				before.record.id !== after.record.id ||
				context.mappingVersion !== `musicbrainz.${after.type}.1`
			)
				throw new TypeError("Supporting source identity or mapping version changed");
			await loadCatalogSourceDocument(
				tx,
				context.sourceRecordId,
				context.previousSnapshotId,
				beforeArchive.receipt,
				beforeArchive.bytes,
			);
			const observation = await loadCatalogSourceDocument(
				tx,
				context.sourceRecordId,
				context.snapshotId,
				afterArchive.receipt,
				afterArchive.bytes,
			);
			const target = musicBrainzSupportingTarget(after),
				currentIdentity = await loadCatalogIdentity(tx, context.reference, context.actor, true);
			if (target.owner !== context.reference.owner || target.shape !== currentIdentity.shape)
				throw new TypeError(
					"Supporting update requires separately reviewed native reclassification",
				);
			if (before.type === "area" && after.type === "area")
				for (const field of ["iso-3166-1-codes", "iso-3166-2-codes", "iso-3166-3-codes"] as const)
					if (!isDeepStrictEqual(before.record[field] ?? [], after.record[field] ?? []))
						throw new TypeError("Area code update requires its native occurrence journal");
			if (
				before.type === "series" &&
				after.type === "series" &&
				(before.record.type !== after.record.type ||
					before.record["type-id"] !== after.record["type-id"])
			)
				throw new TypeError("Series type update requires its native classification journal");
			let revision = context.expectedRevision;
			const changes: CatalogSourceNativeChange[] = [];
			const incoming = await musicBrainzSupportingProfile(
				tx,
				context.actor,
				observation,
				after,
				"prepared",
			);
			if (incoming) {
				const source = parseCatalogSourceProfile(
					incoming.owner,
					incoming.profile,
					musicBrainzSupportingObservedProfileFields(after),
				);
				const previous = await readCatalogSourceProfile(tx, context.reference, context.actor, {
					sourceRecordId: context.sourceRecordId,
					snapshotId: context.previousSnapshotId,
					mappingKey: context.mappingKey,
					correspondenceRevision: context.correspondenceRevision,
				});
				if (!previous)
					throw new TypeError("Supporting previous pure profile occurrence is missing");
				const head = await readCatalogProfileHead(tx, context.reference, context.actor);
				if (!head || head.removed)
					throw new CatalogRevisionConflict("Supporting native profile was independently removed");
				const current =
					incoming.owner === "entity"
						? EntityProfileSchema.parse(head.snapshot)
						: ReferenceProfileSchema.parse(head.snapshot);
				const desired = mergeCatalogSourceProfile(incoming.owner, current, previous, source);
				const evidence = {
					sourceRecordId: context.sourceRecordId,
					snapshotId: context.snapshotId,
					sourcePath: "/",
					...source,
				};
				if (!isDeepStrictEqual(desired, current)) {
					const saved = await writeCatalogSourceProfile(
						tx,
						context.reference,
						context.actor,
						revision,
						{
							expectedProfileRevision: head.revision,
							profile: desired,
							...evidence,
						},
					);
					revision = saved.revision;
					changes.push(saved.change);
				} else
					await bindCatalogProfileSourceOccurrence(tx, context.reference, context.actor, {
						...evidence,
						revision: head.revision,
					});
			}
			const named = await applyMusicBrainzNameDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				context.sourceRecordId,
				context.mappingKey,
				context.previousSnapshotId,
				context.snapshotId,
				names(before),
				names(after),
				after.type === "url" ? "/resource" : "/name",
			);
			changes.push(...named.changes);
			revision = named.revision;
			const assertions = await applyMusicBrainzFactDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				observation,
				{
					snapshotId: context.previousSnapshotId,
					mappingKey: context.mappingKey,
					record: facts(before),
				},
				facts(after),
			);
			changes.push(...assertions.changes);
			revision = assertions.revision;
			const claims = await applyMusicBrainzIdentifierDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				{ ...context, previousSnapshotId: context.previousSnapshotId },
				identifiers(before),
				identifiers(after),
			);
			changes.push(...claims.changes);
			revision = claims.revision;
			const relations = await applyMusicBrainzRelationDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				observation,
				{
					snapshotId: context.previousSnapshotId,
					mappingKey: context.mappingKey,
					relations: before.record.relations ?? [],
				},
				after.record.relations ?? [],
			);
			changes.push(...relations.changes);
			revision = relations.revision;
			if (revision === context.expectedRevision)
				revision = await recordCatalogChange(
					tx,
					context.reference,
					context.actor,
					revision,
					"musicbrainz.source.observed",
				);
			return { revision, changes };
		});
}
