import { withCatalogSourceReceipts } from "./source-observations";
import { assertMusicBrainzReleaseArchive } from "./musicbrainz-release-bundle";
import { MUSIC_SOURCE_DEPENDENCY_LIMIT } from "@rezics/schema/postgres/ingestion/source-limits";
import { adoptMusicBrainzRelations } from "./musicbrainz-relations";
import type { DatabaseTransaction } from "../database";
import { z } from "zod";
import type { CatalogOwner } from "@rezics/schema/contracts/native/catalog";
import { MusicBrainzRelationEndpointFamilies } from "./musicbrainz-relation-plan";
import { musicRecording, musicReleaseGroup } from "@rezics/schema/postgres/music/music";
import {
	currentParticipationAuthority,
	ParticipationDenied,
	runParticipationSavepoint,
} from "../participation/policy";
import {
	MusicBrainzReleaseSchema,
	MusicBrainzObjectDocumentSchema,
	MusicBrainzCatalogContractSha256,
	MusicBrainzRelationSchema,
	type MusicBrainzCredit,
	type MusicBrainzRelease,
	type MusicBrainzRecording,
	type MusicBrainzReleaseGroup,
} from "./musicbrainz";
import {
	musicBrainzVocabulary,
	musicBrainzArtistReference,
	musicBrainzAreaReference,
	musicBrainzLabelReference,
	musicBrainzCreditWriter,
	projectMusicBrainzIdentifiers,
	projectMusicBrainzGroupTypes,
} from "./musicbrainz-native";
import { tracks } from "./musicbrainz-release-plan";
import { parseMusicBrainzSupportingEndpoint } from "./musicbrainz-entities";
import { bindReferencedSourceIdentity } from "./source-references";
import { prepareCatalogSourceProposalDependency } from "./source-dependencies";
import { catalogSourceRecordId } from "./source-record-key";
import { loadCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";

/** @internal Heavy reference initialization uses half the ordinary proposal bound to leave room within the 25-second transaction. */
export const MusicReleaseDependencyPageSize = 64;
type Area = NonNullable<NonNullable<MusicBrainzRelease["release-events"]>[number]["area"]>;
type Label = NonNullable<NonNullable<MusicBrainzRelease["label-info"]>[number]["label"]>;
type Dependency = { path: string } & (
	| { kind: "artist"; value: MusicBrainzCredit[number]["artist"] }
	| { kind: "area"; value: Area }
	| { kind: "label"; value: Label }
	| { kind: "recording"; value: MusicBrainzRecording }
	| { kind: "release_group"; value: MusicBrainzReleaseGroup }
	| {
			kind: "relation";
			binding: {
				objectType: string;
				externalId: string;
				owner: CatalogOwner;
				shape: string;
				name?: string;
			};
	  }
	| {
			kind: "vocabulary";
			family: string;
			id: string | null | undefined;
			name: string | null | undefined;
			namePath: string;
	  }
);

function sourceKey(item: Dependency) {
	if (item.kind === "relation")
		return {
			source: "musicbrainz",
			objectType: item.binding.objectType,
			externalId: item.binding.externalId,
		};
	return {
		source: "musicbrainz",
		objectType: item.kind === "vocabulary" ? item.family : item.kind,
		externalId: item.kind === "vocabulary" ? item.id || item.name || "" : item.value.id,
	};
}

/** @internal A document-local plan admits at most 128 distinct native read dependencies. */
export function planMusicBrainzDependencies(
	objectType: string,
	input: unknown,
	maximum = 128,
): readonly Dependency[] {
	if (maximum !== 128 && maximum !== MUSIC_SOURCE_DEPENDENCY_LIMIT) throw new TypeError("Unreviewed dependency plan capacity");
	const dependencies = new Map<string, Dependency>();
	const add = (item: Dependency) => {
		const key = sourceKey(item);
		if (!key.externalId) return;
		const identity = catalogSourceRecordId(key);
		if (!dependencies.has(identity)) dependencies.set(identity, item);
		if (dependencies.size > maximum)
			throw new RangeError("MusicBrainz dependencies require staged preparation");
	};
	const vocabulary = (
		family: string,
		id: string | null | undefined,
		name: string | null | undefined,
		idPath: string,
		namePath: string,
	) => add({ kind: "vocabulary", family, id, name, path: id ? idPath : namePath, namePath });
	const credit = (members: MusicBrainzCredit | undefined, path: string) => {
		for (const [position, member] of (members ?? []).entries())
			add({ kind: "artist", value: member.artist, path: `${path}/${position}/artist/id` });
	};
	if (objectType === "release") {
		const release = MusicBrainzReleaseSchema.parse(input);
		credit(release["artist-credit"], "/artist-credit");
		vocabulary("release_status", release["status-id"], release.status, "/status-id", "/status");
		vocabulary(
			"release_packaging",
			release["packaging-id"],
			release.packaging,
			"/packaging-id",
			"/packaging",
		);
		if (release["release-group"])
			add({ kind: "release_group", value: release["release-group"], path: "/release-group/id" });
		for (const [index, medium] of release.media.entries()) {
			vocabulary(
				"medium_format",
				medium["format-id"],
				medium.format,
				`/media/${index}/format-id`,
				`/media/${index}/format`,
			);
			for (const entry of tracks(medium, index)) {
				credit(entry.track["artist-credit"], `${entry.path}/artist-credit`);
				add({
					kind: "recording",
					value: entry.track.recording,
					path: `${entry.path}/recording/id`,
				});
			}
		}
		for (const [index, event] of (release["release-events"] ?? []).entries())
			if (event.area)
				add({ kind: "area", value: event.area, path: `/release-events/${index}/area/id` });
		for (const [index, label] of (release["label-info"] ?? []).entries())
			if (label.label)
				add({ kind: "label", value: label.label, path: `/label-info/${index}/label/id` });
	} else if (["work", "recording", "release_group"].includes(objectType)) {
		const document = MusicBrainzObjectDocumentSchema.parse({ kind: objectType, record: input });
		if (document.kind === "work")
			vocabulary(
				"work_type",
				document.record["type-id"],
				document.record.type,
				"/type-id",
				"/type",
			);
		else {
			credit(document.record["artist-credit"], "/artist-credit");
			if (document.kind === "release_group") {
				vocabulary(
					"release_group_primary_type",
					document.record["primary-type-id"],
					document.record["primary-type"],
					"/primary-type-id",
					"/primary-type",
				);
				const ids = document.record["secondary-type-ids"] ?? [],
					names = document.record["secondary-types"] ?? [];
				for (let index = 0; index < Math.max(ids.length, names.length); index++)
					vocabulary(
						"release_group_secondary_type",
						ids[index],
						names[index],
						`/secondary-type-ids/${index}`,
						`/secondary-types/${index}`,
					);
			}
		}
	} else {
		const document = parseMusicBrainzSupportingEndpoint(objectType, input);
		if (!["url", "series", "genre", "mood"].includes(document.type)) {
			const record = document.record;
			const id = typeof record["type-id"] === "string" ? record["type-id"] : null;
			const name = typeof record.type === "string" ? record.type : null;
			vocabulary(`${document.type}_type`, id, name, "/type-id", "/type");
		}
		if (document.type === "artist") {
			vocabulary(
				"gender",
				document.record["gender-id"],
				document.record.gender,
				"/gender-id",
				"/gender",
			);
			for (const field of ["area", "begin-area", "end-area"] as const)
				if (document.record[field])
					add({ kind: "area", value: document.record[field], path: `/${field}/id` });
		} else if ((document.type === "label" || document.type === "place") && document.record.area)
			add({ kind: "area", value: document.record.area, path: "/area/id" });
	}
	const sourceRelations = z
		.object({ id: z.uuid(), relations: z.array(MusicBrainzRelationSchema).max(128).optional() })
		.parse(input);
	for (const [index, relation] of (sourceRelations.relations ?? []).entries()) {
		const key =
			relation["target-type"] === "release_group" ? "release-group" : relation["target-type"];
		const target = relation[key];
		if (!target) throw new TypeError("MusicBrainz relationship dependency is missing its target");
		const family = MusicBrainzRelationEndpointFamilies[key];
		if (key.replaceAll("-", "_") === objectType && target.id === sourceRelations.id) continue;
		add({
			kind: "relation",
			path: `/relations/${index}/${key}/id`,
			binding: {
				objectType: key.replaceAll("-", "_"),
				externalId: target.id,
				owner: family.owner,
				shape: family.shape,
				name:
					"name" in target && typeof target.name === "string"
						? target.name
						: "title" in target && typeof target.title === "string"
							? target.title
							: undefined,
			},
		});
	}
	return [...dependencies.values()];
}

/** @internal Direct human intake materializes references and shares only their exact pending-proposal read scope. */
export async function prepareMusicBrainzProposalDependencies(
	outer: DatabaseTransaction,
	actor: string,
	input: {
		proposalId: string | null;
		afterPosition?: number;
		sourcePage?: true;
		purpose?: "incoming" | "previous-for-withdrawal";
		sourceRecordId: string;
		snapshotId: string;
		receipt: CatalogSourceReceipt;
		bytes: Uint8Array;
	},
) {
	const afterPosition = z.number().int().min(0).max(MUSIC_SOURCE_DEPENDENCY_LIMIT).parse(input.afterPosition ?? 0);
	if (input.proposalId === null && !input.sourcePage) throw new TypeError("Unscoped dependency preparation requires an admitted source page");
	const authority = currentParticipationAuthority();
	if (
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.principal.authUserId !== actor ||
		authority.grant
	)
		throw new ParticipationDenied(
			"MusicBrainz dependency preparation requires direct human intake authority",
		);
	return withCatalogSourceReceipts([input.receipt], () => runParticipationSavepoint(outer, async (tx) => {
		if (input.receipt.key.objectType === "release") assertMusicBrainzReleaseArchive(input.receipt);
		const observation = await loadCatalogSourceDocument(
			tx,
			input.sourceRecordId,
			input.snapshotId,
			input.receipt,
			input.bytes,
		);
		if (
			observation.record.source !== "musicbrainz" ||
			input.receipt.contractSha256 !== MusicBrainzCatalogContractSha256
		)
			throw new TypeError("MusicBrainz dependency document has another source kind");
		const plan = planMusicBrainzDependencies(
			observation.record.objectType,
			JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)),
			input.sourcePage ? MUSIC_SOURCE_DEPENDENCY_LIMIT : 128,
		);
		for (const item of plan)
			if (observation.referenceAt(item.path).externalId !== sourceKey(item).externalId)
				throw new TypeError("MusicBrainz dependency identity differs from archived evidence");
		const prepared = [];
		const pageSize=input.sourcePage ? MusicReleaseDependencyPageSize : 128;
		for (const [offset, item] of plan.slice(afterPosition, afterPosition + pageSize).entries()) {
			const position = afterPosition + offset + (input.purpose === "previous-for-withdrawal" ? MUSIC_SOURCE_DEPENDENCY_LIMIT : 0);
			const path = item.path.slice(0, -3);
			switch (item.kind) {
				case "relation":
					await bindReferencedSourceIdentity(tx, actor, {
						source: "musicbrainz",
						...item.binding,
						evidence: observation.referenceAt(item.path),
					});
					break;
				case "vocabulary":
					await musicBrainzVocabulary(tx, item.family, item.id, item.name, {
						actor,
						observation,
						idPath: item.path,
						namePath: item.namePath,
					});
					break;
				case "artist":
					await musicBrainzArtistReference(tx, actor, observation, item.value, path);
					break;
				case "area":
					await musicBrainzAreaReference(tx, actor, observation, item.value, path);
					break;
				case "label":
					await musicBrainzLabelReference(tx, actor, observation, item.value, path);
					break;
				case "recording":
				case "release_group": {
					await bindReferencedSourceIdentity(tx, actor, {
						...sourceKey(item),
						owner: "music",
						shape: item.kind,
						name: item.value.title,
						evidence: observation.referenceAt(item.path),
						initialize: async (created) => {
							const credit = musicBrainzCreditWriter(tx, actor, observation, created);
							if (item.kind === "release_group") {
								await tx.insert(musicReleaseGroup).values({ id: created.id,
									artistCreditId: await credit(item.value["artist-credit"], `${path}/artist-credit`),
									primaryTypeRevisionId: await musicBrainzVocabulary(tx, "release_group_primary_type", item.value["primary-type-id"], item.value["primary-type"], {
										actor, observation, idPath: `${path}/primary-type-id`, namePath: `${path}/primary-type` }) });
								await projectMusicBrainzGroupTypes(tx, created.id, item.value, undefined, { actor, observation, path });
							} else {
								await tx.insert(musicRecording).values({ id: created.id, lengthMilliseconds: item.value.length ?? null,
									video: item.value.video ?? null, artistCreditId: await credit(item.value["artist-credit"], `${path}/artist-credit`) });
								await projectMusicBrainzIdentifiers(tx, created.id, "isrc", item.value.isrcs ?? [], observation, `${path}/isrcs`);
							}
							const revision = await adoptMusicBrainzRelations(tx, actor, created, created.revision, observation, item.value.relations ?? [], `${path}/relations`);
							return { ...created, revision };

						},
					});
				}
			}
			if (input.proposalId) prepared.push(
				await prepareCatalogSourceProposalDependency(tx, actor, {
					sourceRecordId: observation.record.id,
					proposalId: input.proposalId,
					position,
					purpose: input.purpose,
					dependencySourceRecordId: catalogSourceRecordId(sourceKey(item)),
					evidence: observation.referenceAt(item.path),
				}),
			);
		}
		return prepared;
	}));
}
