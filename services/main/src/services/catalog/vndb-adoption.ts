import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import {
	softwareContent,
	softwareEdition,
	softwareVisualNovel,
} from "../database/schema/catalog-software";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { catalogSourceMappingClaim } from "../database/schema/catalog-source";
import { type CatalogSourceReceipt, recordCatalogSourceObservation } from "./source-observations";
import { inspectExistingSourceBinding } from "./source-adoption";
import { VndbCatalogContractSha256, VndbVnSchema, vndbLanguage, vndbSourceKey } from "./vndb";
import { addCatalogName, createCatalogIdentity } from "./storage";
import { appendSourceFieldObservation } from "./source-fields";

/** VN identity/edition projection; staff and voice contexts remain identified source observations. */
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
	const observation = await recordCatalogSourceObservation(tx, receipt);
	const existing = await inspectExistingSourceBinding(tx, actor, observation, "vndb.vn.1");
	if (existing) return existing;
	const identity = await createCatalogIdentity(tx, { owner: "software", shape: "content" }, actor);
	await tx.insert(softwareContent).values({ id: identity.id });
	const minutes = record.length_minutes;
	await tx.insert(softwareVisualNovel).values({
		id: identity.id,
		lengthMinutes:
			minutes !== null && minutes !== undefined && Number.isSafeInteger(minutes) && minutes >= 0
				? minutes
				: null,
	});
	let revision = identity.revision;
	if (record.title)
		revision = (
			await addCatalogName(tx, identity, actor, revision, {
				kind: "source-primary",
				languageTag: null,
				value: record.title,
			})
		).revision;
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
	const editions = record.editions ?? [];
	for (let offset = 0; offset < editions.length; offset += 128)
		await tx.insert(softwareEdition).values(
			editions.slice(offset, offset + 128).map((edition) => ({
				contentId: identity.id,
				sourceNamespace: "vndb",
				sourceLocalId: String(edition.eid),
				name: edition.name,
			})),
		);
	await tx.insert(CatalogFactTables.software.identifier).values({
		ownerId: identity.id,
		namespace: "vndb.vn",
		value: record.id,
		normalizedValue: record.id,
	});
	for (const [field, value] of Object.entries(record))
		revision = await appendSourceFieldObservation(tx, identity, actor, revision, {
			namespace: "source.vndb.vn",
			field,
			value,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
		});
	const [claim] = await tx
		.insert(catalogSourceMappingClaim)
		.values({
			sourceRecordId: observation.record.id,
			path: "/",
			owner: "software",
			observedSnapshotId: observation.snapshot.id,
		})
		.returning();
	if (!claim) throw new Error("VNDB mapping claim insertion returned no row");
	await tx
		.insert(CatalogFactTables.software.sourceBinding)
		.values({ ownerId: identity.id, mappingKey: claim.mappingKey, mappingOwner: "software" });
	return {
		status: "created" as const,
		reference: { owner: "software" as const, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}
