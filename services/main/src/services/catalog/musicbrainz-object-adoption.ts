import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { musicRecording, musicReleaseGroup, musicWork } from "../database/schema/catalog-music";
import { bindCatalogSourceIdentity, acceptCatalogSourceInitialization } from "./source-bindings";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { createCatalogIdentity, addCatalogName } from "./storage";
import { adoptMusicBrainzRelations } from "./musicbrainz-relations";
import { adoptMusicBrainzAliases } from "./musicbrainz-names";
import { inspectExistingSourceBinding } from "./source-adoption";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import {
	MusicBrainzCatalogContractSha256,
	MusicBrainzRecordingSchema,
	MusicBrainzReleaseGroupSchema,
	MusicBrainzWorkSchema,
} from "./musicbrainz";
import {
	musicBrainzCreditWriter,
	musicBrainzVocabulary,
	projectMusicBrainzGroupTypes,
	projectMusicBrainzIdentifiers,
	projectMusicBrainzWorkLanguages,
	projectMusicBrainzWorkAttributes,
} from "./musicbrainz-native";

const documentSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("work"), record: MusicBrainzWorkSchema }),
	z.object({ kind: z.literal("recording"), record: MusicBrainzRecordingSchema }),
	z.object({ kind: z.literal("release_group"), record: MusicBrainzReleaseGroupSchema }),
]);

/** @alpha Independent musical objects do not require a release or an invented work parent. */
export async function adoptMusicBrainzObject(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("MusicBrainz projection bytes differ from the archived observation");
	if (
		receipt.contractSha256 !== MusicBrainzCatalogContractSha256 ||
		receipt.key.source !== "musicbrainz"
	)
		throw new TypeError("Unreviewed MusicBrainz source contract");
	const document = documentSchema.parse({
		kind: receipt.key.objectType,
		record: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	});
	if (receipt.key.externalId !== document.record.id)
		throw new TypeError("MusicBrainz object differs from its source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		`musicbrainz.${document.kind}.2`,
	);
	if (existing && existing.status !== "initialize_reference") return existing;
	if (existing && existing.reference.owner !== "music")
		throw new TypeError("MusicBrainz source resolves to another catalog owner");
	const identity = existing
		? { ...existing.reference, revision: existing.revision }
		: await createCatalogIdentity(tx, { owner: "music", shape: document.kind }, actor);
	const credit = musicBrainzCreditWriter(tx, actor, observation);
	switch (document.kind) {
		case "work": {
			const typeRevisionId = await musicBrainzVocabulary(
				tx,
				"work_type",
				document.record["type-id"],
				document.record.type,
			);
			await tx
				.insert(musicWork)
				.values({ id: identity.id, typeRevisionId })
				.onConflictDoUpdate({
					target: musicWork.id,
					set: {
						typeRevisionId:
							document.record.type !== undefined || document.record["type-id"] !== undefined
								? typeRevisionId
								: musicWork.typeRevisionId,
					},
				});
			await projectMusicBrainzWorkLanguages(tx, identity.id, document.record);
			await projectMusicBrainzIdentifiers(tx, identity.id, "iswc", document.record.iswcs ?? []);
			break;
		}
		case "recording": {
			const artistCreditId = await credit(document.record["artist-credit"], "/artist-credit");
			await tx
				.insert(musicRecording)
				.values({
					id: identity.id,
					artistCreditId,
					lengthMilliseconds: document.record.length ?? null,
					video: document.record.video ?? null,
				})
				.onConflictDoUpdate({
					target: musicRecording.id,
					set: {
						artistCreditId:
							document.record["artist-credit"] !== undefined
								? artistCreditId
								: musicRecording.artistCreditId,
						lengthMilliseconds:
							document.record.length !== undefined
								? document.record.length
								: musicRecording.lengthMilliseconds,
						video:
							document.record.video !== undefined ? document.record.video : musicRecording.video,
					},
				});
			await projectMusicBrainzIdentifiers(tx, identity.id, "isrc", document.record.isrcs ?? []);
			break;
		}
		case "release_group": {
			const artistCreditId = await credit(document.record["artist-credit"], "/artist-credit");
			const primaryTypeRevisionId = await musicBrainzVocabulary(
				tx,
				"release_group_primary_type",
				document.record["primary-type-id"],
				document.record["primary-type"],
			);
			await tx
				.insert(musicReleaseGroup)
				.values({ id: identity.id, artistCreditId, primaryTypeRevisionId })
				.onConflictDoUpdate({
					target: musicReleaseGroup.id,
					set: {
						artistCreditId:
							document.record["artist-credit"] !== undefined
								? artistCreditId
								: musicReleaseGroup.artistCreditId,
						primaryTypeRevisionId:
							document.record["primary-type"] !== undefined ||
							document.record["primary-type-id"] !== undefined
								? primaryTypeRevisionId
								: musicReleaseGroup.primaryTypeRevisionId,
					},
				});
			await projectMusicBrainzGroupTypes(tx, identity.id, document.record);
			break;
		}
	}

	let revision = identity.revision;
	if (document.record.title)
		revision = (
			await addCatalogName(tx, identity, actor, revision, {
				kind: "source-primary",
				languageTag: null,
				value: document.record.title,
			})
		).revision;
	revision = await adoptMusicBrainzAliases(
		tx,
		actor,
		identity,
		revision,
		observation,
		document.record.aliases ?? [],
	);
	if (!existing)
		await tx.insert(CatalogFactTables.music.identifier).values({
			ownerId: identity.id,
			namespace: `musicbrainz.${document.kind}`,
			value: document.record.id,
			normalizedValue: document.record.id,
		});
	revision = await adoptMusicBrainzRelations(
		tx,
		actor,
		identity,
		revision,
		observation,
		document.record.relations ?? [],
	);
	if (document.kind === "work")
		revision = await projectMusicBrainzWorkAttributes(
			tx,
			actor,
			identity,
			revision,
			observation,
			document.record,
		);
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference: identity,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await bindCatalogSourceIdentity(tx, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference: identity,
		});

	return {
		status: "created" as const,
		reference: { owner: "music" as const, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}
