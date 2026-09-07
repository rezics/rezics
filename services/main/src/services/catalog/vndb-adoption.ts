import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import {
	softwareParticipationSourceOccurrence,
	softwareVisualNovel,
} from "../database/schema/catalog-software";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { bindCatalogSourceIdentity, acceptCatalogSourceInitialization } from "./source-bindings";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { inspectExistingSourceBinding } from "./source-adoption";
import { VndbCatalogContractSha256, VndbVnSchema, vndbLanguage, vndbSourceKey } from "./vndb";
import { addCatalogName } from "./storage";
import { createSoftwareParticipationContext } from "./software-contexts";
import { createNativeSoftwareContent, reviseSoftwareContent } from "./software";
import { appendVndbSemantics } from "./vndb-semantics";

/** VN identity and snapshot-local participation observations; staff adoption remains separate. */
export async function adoptVndbVn(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("VNDB projection bytes differ from the archived observation");
	if (receipt.contractSha256 !== VndbCatalogContractSha256)
		throw new Error("VNDB source contract has not been reviewed for this mapper");
	const record = VndbVnSchema.parse(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	const source = vndbSourceKey(record.id);
	if (
		receipt.key.source !== source.source ||
		receipt.key.objectType !== source.objectType ||
		receipt.key.externalId !== source.externalId
	)
		throw new TypeError("VNDB payload identity differs from its source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(tx, actor, observation, "vndb.vn.1");
	if (existing && existing.status !== "initialize_reference") return existing;
	const details = {
		originalLanguageTag: record.olang ? vndbLanguage(record.olang) : null,
		developmentStatus:
			record.devstatus === 0
				? ("finished" as const)
				: record.devstatus === 1
					? ("in_development" as const)
					: record.devstatus === 2
						? ("cancelled" as const)
						: null,
		description: record.description ?? null,
	};
	const identity = existing
		? {
				...existing.reference,
				revision: (
					await reviseSoftwareContent(tx, existing.reference, actor, existing.revision, details)
				).revision,
			}
		: await createNativeSoftwareContent(tx, actor, {
				name: { value: record.title, languageTag: null },
				details,
			});
	const minutes = record.length_minutes;
	await tx
		.insert(softwareVisualNovel)
		.values({
			id: identity.id,
			lengthMinutes:
				minutes !== null && minutes !== undefined && Number.isSafeInteger(minutes) && minutes >= 0
					? minutes
					: null,
		})
		.onConflictDoNothing();
	let revision = identity.revision;
	for (const title of record.titles ?? []) {
		const languageTag = vndbLanguage(title.lang);
		if (title.title)
			revision = (
				await addCatalogName(tx, identity, actor, revision, {
					kind: "source-title",
					languageTag,
					value: title.title,
				})
			).revision;
		if (title.latin)
			revision = (
				await addCatalogName(tx, identity, actor, revision, {
					kind: "source-transliteration",
					languageTag: null,
					value: title.latin,
				})
			).revision;
	}
	for (const alias of record.aliases ?? [])
		if (alias)
			revision = (
				await addCatalogName(tx, identity, actor, revision, {
					kind: "source-alias",
					languageTag: null,
					value: alias,
				})
			).revision;
	for (const [position, edition] of (record.editions ?? []).entries()) {
		const languageTag = edition.lang === null ? null : vndbLanguage(edition.lang);
		const context = await createSoftwareParticipationContext(tx, identity, actor, {
			label: edition.name || null,
			languageTag,
			state: "active",
		});
		await tx.insert(softwareParticipationSourceOccurrence).values({
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			namespace: "editions",
			localKey: String(edition.eid),
			contentId: identity.id,
			contextId: context.contextId,
			contextRevision: context.revision,
			sourcePointer: `/editions/${position}`,
			sourceLabel: edition.name,
			sourceLanguage: edition.lang,
			sourceLanguageTag: languageTag,
			sourceClaimedOfficial: edition.official,
		});
	}
	if (!existing)
		await tx.insert(CatalogFactTables.software.identifier).values({
			ownerId: identity.id,
			namespace: "vndb.vn",
			value: record.id,
			normalizedValue: record.id,
		});
	revision = await appendVndbSemantics(tx, identity, actor, revision, record, observation);
	const reference = { owner: "software" as const, id: identity.id };
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await bindCatalogSourceIdentity(tx, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference,
		});
	return {
		status: "created" as const,
		reference: { owner: "software" as const, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}
