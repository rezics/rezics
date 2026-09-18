import { addCatalogIdentifier } from "../catalog/identifiers";
import { ensureCatalogDefinition } from "../catalog/storage";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import type { PackObject } from "./contracts";
import { ContentPackInvalid } from "./errors";
import { nativePackReference } from "./native-contracts";
import { createCatalogIdentity, addCatalogName, loadCatalogIdentity } from "../catalog/storage";
import { updatePublishingStructure } from "../catalog/publishing";
import { updateProgramStructure } from "../catalog/program";
import { initializeEntityProfile } from "../catalog/entities";
import { initializeReferenceProfile } from "../catalog/references";
import { assignGroupingClass } from "../catalog/grouping";
import { reviseSoftwareContent, reviseSoftwareRelease } from "../catalog/software";
import { requireMusicCreditAccess } from "../catalog/music-credit-access";
import { beginDistributionManifest } from "../catalog/distribution";
import {
	musicWork,
	musicRecording,
	musicReleaseGroup,
	musicRelease,
} from "@rezics/schema/postgres/music/music";
import { softwareVersion, softwareVisualNovel } from "@rezics/schema/postgres/software/software";
import { distributionPackage } from "@rezics/schema/postgres/publishing/distribution";

/** Complete native owner initialization with a deterministic pack ID, in the caller's transaction. */
export async function insertNativePackObject(
	tx: DatabaseTransaction,
	object: PackObject,
	id: string,
	actor: string,
): Promise<void> {
	const value = object.native;
	if (!value) throw new ContentPackInvalid("Missing native declaration");
	const reference = { ...nativePackReference(value), id };
	if (reference.owner !== object.identity.owner || reference.shape !== object.identity.shape)
		throw new ContentPackInvalid("Native identity differs from its complete declaration");
	const identity = await createCatalogIdentity(
		tx,
		{
			...reference,
			status: object.identity.status,
			visibility: object.identity.visibility,
			contentRating: object.identity.contentRating,
			moderationStatus: object.identity.moderationStatus,
		},
		actor,
	);
	let revision = identity.revision;
	switch (value.kind) {
		case "publishing_work":
			revision = (
				await updatePublishingStructure(tx, reference, actor, revision, {
					shape: "work",
					fields: {},
				})
			).revision;
			break;
		case "text_version":
			revision = (
				await updatePublishingStructure(tx, reference, actor, revision, {
					shape: "text_version",
					fields: { languageTag: value.languageTag },
				})
			).revision;
			break;
		case "publication":
			revision = (
				await updatePublishingStructure(tx, reference, actor, revision, {
					shape: "publication",
					fields: { pageCount: value.pageCount, paginationText: value.paginationText },
				})
			).revision;
			break;
		case "serialization":
			revision = (
				await updatePublishingStructure(tx, reference, actor, revision, {
					shape: "serialization",
					fields: { textVersionId: value.textVersionId, statusRevisionId: value.statusRevisionId },
				})
			).revision;
			break;
		case "program":
			revision = (await updateProgramStructure(tx, reference, actor, revision, value.structure))
				.revision;
			break;
		case "entity":
			revision = (
				await initializeEntityProfile(tx, reference, actor, revision, value.profile ?? {})
			).revision;
			break;
		case "reference":
			revision = (await initializeReferenceProfile(tx, reference, actor, revision, value.profile))
				.revision;
			break;
		case "grouping":
			for (const classId of value.classes ?? [])
				revision = (await assignGroupingClass(tx, reference, actor, revision, classId)).revision;
			break;
		case "software_content":
			revision = (await reviseSoftwareContent(tx, reference, actor, revision, value.details ?? {}))
				.revision;
			if (value.visualNovel) await tx.insert(softwareVisualNovel).values({ id });
			break;
		case "software_release":
			revision = (await reviseSoftwareRelease(tx, reference, actor, revision, value.details ?? {}))
				.revision;
			break;
		case "software_version": {
			const content = await loadCatalogIdentity(tx, value.content, actor, false);
			if (value.content.owner !== "software" || content.shape !== "content")
				throw new ContentPackInvalid("Software version parent must be native software content");
			await tx.insert(softwareVersion).values({ id, contentId: content.id, ...value.details });
			break;
		}
		case "musical_work":
			await tx.insert(musicWork).values({ id });
			break;
		case "release_group":
			await tx.insert(musicReleaseGroup).values({ id });
			break;
		case "recording":
			if (value.artistCreditId) await requireMusicCreditAccess(tx, actor, [value.artistCreditId]);
			await tx.insert(musicRecording).values({
				id,
				artistCreditId: value.artistCreditId ?? null,
				lengthMilliseconds: value.lengthMilliseconds ?? null,
				video: value.video ?? null,
			});
			break;
		case "music_release": {
			if (value.artistCreditId) await requireMusicCreditAccess(tx, actor, [value.artistCreditId]);
			if (value.releaseGroup) {
				const group = await loadCatalogIdentity(tx, value.releaseGroup, actor, false);
				if (value.releaseGroup.owner !== "music" || group.shape !== "release_group")
					throw new ContentPackInvalid("Music release group has the wrong native shape");
			}
			await tx.insert(musicRelease).values({
				id,
				releaseGroupId: value.releaseGroup?.id ?? null,
				artistCreditId: value.artistCreditId ?? null,
				languageTag: value.languageTag ? canonicalizeContentLanguageTag(value.languageTag) : null,
				scriptCode: value.scriptCode ?? null,
			});
			break;
		}
		case "distribution":
			await tx.insert(distributionPackage).values({ id });
			await beginDistributionManifest(tx, id, actor);
			break;
	}
	const names = [
		value.name,
		...object.localizations
			.filter((entry) => entry.title)
			.map((entry) => ({ languageTag: entry.language, value: entry.title! })),
	];
	const seen = new Set<string>();
	for (const name of names) {
		const languageTag =
			name.languageTag === null ? null : canonicalizeContentLanguageTag(name.languageTag);
		const key = JSON.stringify([languageTag, name.value]);
		if (seen.has(key)) continue;
		seen.add(key);
		revision = (
			await addCatalogName(tx, reference, actor, revision, {
				languageTag,
				value: name.value,
				kind: "primary",
			})
		).revision;
	}
	for (const alias of object.aliases ?? [])
		revision = (
			await addCatalogName(tx, reference, actor, revision, {
				languageTag:
					alias.language === null ? null : canonicalizeContentLanguageTag(alias.language),
				value: alias.term,
				kind: alias.kind,
			})
		).revision;
	for (const identifier of object.nativeIdentifiers ?? [])
		revision = (await addCatalogIdentifier(tx, reference, actor, revision, identifier)).revision;
	for (const definition of object.groupingClasses ?? []) {
		if (reference.owner !== "grouping" || definition.kind !== "class")
			throw new ContentPackInvalid("A Grouping requires class definitions");
		const row = await ensureCatalogDefinition(tx, definition);
		revision = (await assignGroupingClass(tx, reference, actor, revision, row.revisionId)).revision;
	}
}
