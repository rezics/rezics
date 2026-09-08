import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import {
	catalogSourceMappingClaim,
	catalogSourceBindingRevision,
} from "../database/schema/catalog-source";
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
	applyCatalogSourceIdentifierDelta,
	type CatalogSourceIdentifierDescriptor,
} from "./source-identifier-delta";
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
function identifiers(document: MusicBrainzSupportingDocument): CatalogSourceIdentifierDescriptor[] {
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
	beforeArchive: Archive | null,
	afterArchive: Archive,
): CatalogSourceNativeWriter {
	return (outer, context) =>
		runParticipationSavepoint(outer, async (tx) => {
			if (context.action === "withdraw") return compensateMusicSourceApplication(tx, context);
			const before = beforeArchive
					? parseMusicBrainzSupportingDocument(beforeArchive.receipt, beforeArchive.bytes)
					: null,
				after = parseMusicBrainzSupportingDocument(afterArchive.receipt, afterArchive.bytes);
			if (
				(before && (before.type !== after.type || before.record.id !== after.record.id)) ||
				context.mappingVersion !== `musicbrainz.${after.type}.1`
			)
				throw new TypeError("Supporting source identity or mapping version changed");
			if (beforeArchive) {
				if (!context.previousSnapshotId)
					throw new TypeError("Supporting previous snapshot is missing");
				await loadCatalogSourceDocument(
					tx,
					context.sourceRecordId,
					context.previousSnapshotId,
					beforeArchive.receipt,
					beforeArchive.bytes,
				);
			} else {
				if (context.previousSnapshotId)
					throw new TypeError("Supporting previous archive is missing");
				if (after.type === "series")
					throw new TypeError(
						"New series correspondence requires its native classification journal",
					);
				if (
					after.type === "area" &&
					[
						after.record["iso-3166-1-codes"],
						after.record["iso-3166-2-codes"],
						after.record["iso-3166-3-codes"],
					].some((codes) => codes?.length)
				)
					throw new TypeError(
						"New area-code correspondence requires its native occurrence journal",
					);
				const [claim] = await tx
					.select()
					.from(catalogSourceMappingClaim)
					.where(
						and(
							eq(catalogSourceMappingClaim.sourceRecordId, context.sourceRecordId),
							eq(catalogSourceMappingClaim.mappingKey, context.mappingKey),
						),
					)
					.limit(1);
				if (!claim || claim.correspondenceRevision !== context.correspondenceRevision)
					throw new TypeError("Supporting correspondence fence changed");
				if (claim.appliedCorrespondenceRevision !== null) {
					const [previousBinding] = await tx
						.select()
						.from(catalogSourceBindingRevision)
						.where(
							and(
								eq(catalogSourceBindingRevision.sourceRecordId, context.sourceRecordId),
								eq(catalogSourceBindingRevision.mappingKey, context.mappingKey),
								eq(catalogSourceBindingRevision.revision, claim.appliedCorrespondenceRevision),
							),
						)
						.limit(1);
					if (!previousBinding)
						throw new TypeError("Previous supporting interpretation binding is missing");
					const oldTarget = {
						entity: previousBinding.entityId,
						reference: previousBinding.referenceId,
						grouping: previousBinding.groupingId,
					};
					if (
						previousBinding.owner === context.reference.owner &&
						(context.reference.owner === "entity" ||
							context.reference.owner === "reference" ||
							context.reference.owner === "grouping") &&
						oldTarget[context.reference.owner] === context.reference.id
					)
						throw new TypeError(
							"Same-target supporting mapper refresh requires prior native plans",
						);
				}
			}
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
			if (before?.type === "area" && after.type === "area")
				for (const field of ["iso-3166-1-codes", "iso-3166-2-codes", "iso-3166-3-codes"] as const)
					if (!isDeepStrictEqual(before.record[field] ?? [], after.record[field] ?? []))
						throw new TypeError("Area code update requires its native occurrence journal");
			if (
				before?.type === "series" &&
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
				const previous = context.previousSnapshotId
					? await readCatalogSourceProfile(tx, context.reference, context.actor, {
							sourceRecordId: context.sourceRecordId,
							snapshotId: context.previousSnapshotId,
							mappingKey: context.mappingKey,
							correspondenceRevision: context.correspondenceRevision,
						})
					: null;
				if (before && !previous)
					throw new TypeError("Supporting previous pure profile occurrence is missing");
				const head = await readCatalogProfileHead(tx, context.reference, context.actor);
				if (head?.removed || (before && !head))
					throw new CatalogRevisionConflict("Supporting native profile was independently removed");
				const current = head
					? incoming.owner === "entity"
						? EntityProfileSchema.parse(head.snapshot)
						: ReferenceProfileSchema.parse(head.snapshot)
					: null;
				const desired = current
					? mergeCatalogSourceProfile(incoming.owner, current, previous, source)
					: source.sourceProfile;
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
							expectedProfileRevision: head?.revision ?? null,
							profile: desired,
							...evidence,
						},
					);
					revision = saved.revision;
					changes.push(saved.change);
				} else if (head)
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
				before ? names(before) : null,
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
				before && context.previousSnapshotId
					? {
							snapshotId: context.previousSnapshotId,
							mappingKey: context.mappingKey,
							record: facts(before),
						}
					: null,
				facts(after),
			);
			changes.push(...assertions.changes);
			revision = assertions.revision;
			const claims = await applyCatalogSourceIdentifierDelta(
				tx,
				context.reference,
				context.actor,
				revision,
				{ ...context, previousSnapshotId: context.previousSnapshotId ?? context.snapshotId },
				before ? identifiers(before) : [],
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
					snapshotId: context.previousSnapshotId ?? context.snapshotId,
					mappingKey: context.mappingKey,
					relations: before?.record.relations ?? [],
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
