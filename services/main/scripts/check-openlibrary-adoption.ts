import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { CatalogChildSourceTables } from "@rezics/schema/postgres/ingestion/child-source";
import { CatalogStructureSourceTables } from "@rezics/schema/postgres/ingestion/structure-source";
import { catalogSourceMappingClaim } from "@rezics/schema/postgres/ingestion/source";
import {
	publishingPublicationWork,
	publishingReleaseEvent,
} from "@rezics/schema/postgres/publishing/publishing";
import { operationalCapacity } from "@rezics/schema/postgres/operations/operational-durability";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceDocument,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import {
	OpenLibraryContractSha256,
	OpenLibraryMappingVersion,
	openLibrarySourceKey,
} from "../src/services/catalog/openlibrary";
import {
	adoptOpenLibraryRecord,
	createOpenLibraryNativeWriter,
} from "../src/services/catalog/openlibrary-adoption";
import {
	prepareOpenLibraryArchive,
	prepareOpenLibraryProposalDependencies,
} from "../src/services/catalog/openlibrary-runtime";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import {
	addCatalogName,
	loadCatalogIdentity,
	listCatalogNames,
} from "../src/services/catalog/storage";
import { addCatalogIdentifier } from "../src/services/catalog/identifiers";
import {
	readPublishingStructure,
	updatePublishingStructure,
} from "../src/services/catalog/publishing";
import { createEntity, readEntityProfile } from "../src/services/catalog/entities";
import { putPublishingComponent } from "../src/services/catalog/publishing-components";
import { readStructureComponentHead } from "../src/services/catalog/structure-history";
import { readCatalogSourceApplication } from "../src/services/catalog/source-applications";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable OpenLibrary fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("OpenLibrary fixture requires the isolated loopback native target");
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(value) {
		objects.set(value.Key, value.Body);
	},
	async get(value) {
		const bytes = objects.get(value.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
const first = {
	key: "/books/OL987650M",
	type: { key: "/type/edition" },
	title: "Publication A",
	subtitle: "Subtitle A",
	works: [{ key: "/works/OL987650W" }],
	authors: [{ key: "/authors/OL987650A" }],
	number_of_pages: 100,
	pagination: "100 pages",
	publishers: ["Publisher A"],
	publish_date: "2000",
	physical_format: "Hardcover",
	isbn_13: ["9780306406157"],
	languages: [{ key: "/languages/eng" }],
	description: { type: "/type/text", value: "Description A" },
	table_of_contents: [{ label: "I", title: "Opening", pagenum: "1", level: 0 }],
	classifications: { custom_scheme: ["A-1"] },
	unreviewed_extension: { keep: true },
};
const second = {
	...first,
	title: "Publication B",
	works: [{ key: "/works/OL987651W" }],
	authors: [{ key: "/authors/OL987651A" }],
	number_of_pages: 120,
	publishers: ["Publisher B"],
	publish_date: "2001",
	physical_format: "Paperback",
	isbn_13: ["9780306406157", "9781861972712"],
	description: { type: "/type/text", value: "Description B" },
	table_of_contents: [{ label: "I", title: "Revised opening", pagenum: "1", level: 0 }],
};
const author = {
	key: "/authors/OL987650A",
	type: { key: "/type/author" },
	name: "Source contributor",
	alternate_names: ["Alternate contributor"],
	bio: { type: "/type/text", value: "Recorded biography" },
	birth_date: "circa 1900",
};
const work = {
	key: "/works/OL987650W",
	type: { key: "/type/work" },
	title: "Source work",
	authors: [{ author: { key: author.key }, role: "editor", as: "Printed contributor" }],
	first_publish_date: "1999",
	original_languages: [{ key: "/languages/eng" }],
};
async function archived<T extends { key: string }>(value: T) {
	const bytes = Buffer.from(JSON.stringify(value)),
		receipt = await storeCatalogSourcePayload(
			openLibrarySourceKey(value.key),
			bytes,
			OpenLibraryContractSha256,
			null,
			archive,
		);
	return { bytes, receipt };
}
async function proposed(...input: Parameters<typeof proposeCatalogSourceAdoption>) {
	const result = await proposeCatalogSourceAdoption(...input);
	if (result.status !== "proposed")
		throw new Error(`Expected source proposal, received ${result.status}`);
	return result.proposal;
}
const before = await archived(first),
	after = await archived(second),
	authorArchive = await archived(author),
	workArchive = await archived(work);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 30000 }),
	database = drizzle({ client: pool }),
	rollback = new Error("rollback OpenLibrary native fixture");
let assertions = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "OpenLibrary native fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning();
			assert.ok(account);
			await runWithNativeFixtureActor(tx, account.id, async () => {
				for (const key of [
					first.key,
					work.key,
					"/works/OL987651W",
					author.key,
					"/authors/OL987651A",
				]) {
					const id = catalogSourceRecordId(openLibrarySourceKey(key));
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								lane,
								routingBucket: aggregateRoutingBucket("source_record", id),
								maximumRows: 5000n,
								maximumBytes: 128000000n,
							})),
						)
						.onConflictDoNothing();
				}
				const initial = await adoptOpenLibraryRecord(tx, account.id, before.receipt, before.bytes);
				if (initial.status !== "created") throw new Error("Expected fresh OpenLibrary publication");
				assert.equal(initial.reference.owner, "publishing");
				assertions++;
				const root = initial.reference,
					sourceRecordId = catalogSourceRecordId(openLibrarySourceKey(first.key));
				const coverage = await tx
					.select()
					.from(publishingPublicationWork)
					.where(eq(publishingPublicationWork.publicationId, root.id));
				assert.equal(coverage.length, 1);
				assertions++;
				const ownWork = await adoptOpenLibraryRecord(
					tx,
					account.id,
					workArchive.receipt,
					workArchive.bytes,
				);
				assert.equal(ownWork.reference.id, coverage[0]?.workId);
				assertions++;
				const ownAuthor = await adoptOpenLibraryRecord(
					tx,
					account.id,
					authorArchive.receipt,
					authorArchive.bytes,
				);
				const profile = await readEntityProfile(tx, ownAuthor.reference, account.id);
				assert.equal(profile.shape, "unresolved");
				assert.equal(profile.profile.begin, null);
				assertions += 2;
				const native = await readPublishingStructure(tx, root, account.id);
				assert.equal(native.identity.shape, "publication");
				assertions++;
				let revision = (
					await updatePublishingStructure(tx, root, account.id, native.identity.revision, {
						shape: "publication",
						fields: { pageCount: 100, paginationText: "Human pagination" },
					})
				).revision;
				revision = (
					await addCatalogName(tx, root, account.id, revision, {
						value: "Independent title",
						languageTag: "en",
						kind: "human-title",
					})
				).revision;
				revision = (
					await addCatalogIdentifier(tx, root, account.id, revision, {
						namespace: "local.catalog",
						value: "HUMAN",
					})
				).revision;
				const publisher = await createEntity(tx, account.id, {
					shape: "organization",
					name: { value: "Known publisher", languageTag: "en" },
				});
				const [event] = await tx
					.select()
					.from(publishingReleaseEvent)
					.where(eq(publishingReleaseEvent.publicationId, root.id));
				assert.ok(event);
				revision = (
					await putPublishingComponent(tx, root, account.id, revision, event.id, {
						kind: "event",
						publisherEntityId: publisher.id,
						publisherCredit: event.publisherCredit,
						areaId: event.areaId,
						date: { year: event.dateYear, month: event.dateMonth, day: event.dateDay },
						dateText: event.dateText,
					})
				).revision;
				const beforeDocument = await recordCatalogSourceDocument(tx, before.receipt, before.bytes),
					afterDocument = await recordCatalogSourceDocument(tx, after.receipt, after.bytes);
				const [claim] = await tx
					.select()
					.from(catalogSourceMappingClaim)
					.where(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId))
					.limit(1);
				assert.ok(claim);
				const writer = createOpenLibraryNativeWriter({ before, after });
				for (let cycle = 0; cycle < 3; cycle++) {
					const proposal = await proposed(tx, account.id, {
						sourceRecordId,
						mappingKey: claim.mappingKey,
						snapshotId: afterDocument.snapshot.id,
						mappingVersion: OpenLibraryMappingVersion,
					});
					await prepareOpenLibraryProposalDependencies(tx, account.id, {
						sourceRecordId,
						proposalId: proposal.id,
						before: { document: beforeDocument, record: prepareOpenLibraryArchive(before) },
						after: { document: afterDocument, record: prepareOpenLibraryArchive(after) },
					});
					await decideCatalogSourceProposal(
						tx,
						account.id,
						{
							sourceRecordId,
							proposalId: proposal.id,
							mappingVersion: OpenLibraryMappingVersion,
							action: "apply",
							reason: "Qualified native source update",
						},
						writer,
					);
					const changed = await readPublishingStructure(tx, root, account.id);
					assert.ok(changed.record && "pageCount" in changed.record);
					assert.equal(changed.record.pageCount, 120);
					assert.equal(
						"paginationText" in changed.record ? changed.record.paginationText : null,
						"Human pagination",
					);
					assertions += 3;
					const [updatedEvent] = await tx
						.select()
						.from(publishingReleaseEvent)
						.where(
							and(
								eq(publishingReleaseEvent.publicationId, root.id),
								eq(publishingReleaseEvent.id, event.id),
							),
						);
					assert.equal(updatedEvent?.publisherCredit, "Publisher B");
					assert.equal(updatedEvent?.publisherEntityId, publisher.id);
					assertions += 2;
					assert.equal(
						(await listCatalogNames(tx, root, account.id)).some(
							(name) => name.value === "Independent title",
						),
						true,
					);
					assertions++;
					const application = await readCatalogSourceApplication(tx, account.id, {
						sourceRecordId,
						proposalId: proposal.id,
						action: "apply",
					});
					assert.ok(application?.changes.some((change) => change.kind === "catalog-child"));
					assertions++;
					const occurrences = CatalogChildSourceTables.publishing.occurrence;
					const [pure] = await tx
						.select()
						.from(occurrences)
						.where(
							and(
								eq(occurrences.sourceRecordId, sourceRecordId),
								eq(occurrences.snapshotId, afterDocument.snapshot.id),
								eq(occurrences.component, "publishing_release_event"),
							),
						)
						.limit(1);
					assert.ok(pure);
					assert.equal(pure.sourceValue.kind, "event");
					assert.equal(
						"publisherEntityId" in pure.sourceValue.fields
							? pure.sourceValue.fields.publisherEntityId
							: null,
						null,
					);
					assertions += 3;
					await decideCatalogSourceProposal(
						tx,
						account.id,
						{
							sourceRecordId,
							proposalId: proposal.id,
							mappingVersion: OpenLibraryMappingVersion,
							action: "withdraw",
							reason: "Qualified exact native compensation",
						},
						writer,
					);
					const restored = await readPublishingStructure(tx, root, account.id);
					assert.ok(restored.record && "pageCount" in restored.record);
					assert.equal(restored.record.pageCount, 100);
					assert.equal(
						"paginationText" in restored.record ? restored.record.paginationText : null,
						"Human pagination",
					);
					assertions += 3;
					const rows = await tx
						.select()
						.from(publishingPublicationWork)
						.where(eq(publishingPublicationWork.publicationId, root.id));
					assert.equal(rows[0]?.workId, ownWork.reference.id);
					assertions++;
					const [restoredEvent] = await tx
						.select()
						.from(publishingReleaseEvent)
						.where(
							and(
								eq(publishingReleaseEvent.publicationId, root.id),
								eq(publishingReleaseEvent.id, event.id),
							),
						);
					assert.equal(restoredEvent?.publisherEntityId, publisher.id);
					assert.equal(restoredEvent?.publisherCredit, "Publisher A");
					assertions += 2;
				}
				const primitive = CatalogStructureSourceTables.publishing.occurrence;
				const [fixed] = await tx
					.select()
					.from(primitive)
					.where(
						and(
							eq(primitive.sourceRecordId, sourceRecordId),
							eq(primitive.snapshotId, afterDocument.snapshot.id),
						),
					)
					.limit(1);
				assert.ok(fixed);
				assert.equal(fixed.sourceValue.shape, "publication");
				assert.equal(
					"paginationText" in fixed.sourceValue.fields
						? fixed.sourceValue.fields.paginationText
						: null,
					"100 pages",
				);
				assertions += 3;
				const lost = await archived({ ...first, publishers: [], publish_date: undefined }),
					lostDocument = await recordCatalogSourceDocument(tx, lost.receipt, lost.bytes);
				const removal = await proposed(tx, account.id, {
					sourceRecordId,
					mappingKey: claim.mappingKey,
					snapshotId: lostDocument.snapshot.id,
					mappingVersion: OpenLibraryMappingVersion,
				});
				await prepareOpenLibraryProposalDependencies(tx, account.id, {
					sourceRecordId,
					proposalId: removal.id,
					before: { document: beforeDocument, record: prepareOpenLibraryArchive(before) },
					after: { document: lostDocument, record: prepareOpenLibraryArchive(lost) },
				});
				await assert.rejects(
					() =>
						tx.transaction((nested) =>
							decideCatalogSourceProposal(
								nested,
								account.id,
								{
									sourceRecordId,
									proposalId: removal.id,
									mappingVersion: OpenLibraryMappingVersion,
									action: "apply",
									reason: "Must preserve independent event fields",
								},
								createOpenLibraryNativeWriter({ before, after: lost }),
							),
						),
					/independent native fields|later native edit/,
				);
				assertions++;
				const head = await readStructureComponentHead(
					tx,
					root,
					"publishing_release_event",
					event.id,
				);
				assert.ok(head && head.operation !== "DELETE");
				assertions++;
				const unparented = await archived({
					key: "/books/OL987652M",
					type: { key: "/type/edition" },
					title: "No invented parent",
					languages: [{ key: "/languages/jpn" }],
					translation_of: "An unidentified text",
				});
				const unparentedId = catalogSourceRecordId(openLibrarySourceKey("/books/OL987652M"));
				await tx
					.insert(operationalCapacity)
					.values(
						["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
							lane,
							routingBucket: aggregateRoutingBucket("source_record", unparentedId),
							maximumRows: 5000n,
							maximumBytes: 128000000n,
						})),
					)
					.onConflictDoNothing();
				const unlinked = await adoptOpenLibraryRecord(
					tx,
					account.id,
					unparented.receipt,
					unparented.bytes,
				);
				assert.equal(
					(
						await tx
							.select()
							.from(publishingPublicationWork)
							.where(eq(publishingPublicationWork.publicationId, unlinked.reference.id))
					).length,
					0,
				);
				assertions++;
				assert.equal(
					(await loadCatalogIdentity(tx, unlinked.reference, account.id, false)).shape,
					"publication",
				);
				assertions++;
				const identifiers = CatalogFactTables.publishing.identifier;
				assert.equal(
					(
						await tx
							.select()
							.from(identifiers)
							.where(
								and(eq(identifiers.ownerId, root.id), eq(identifiers.namespace, "local.catalog")),
							)
					).length,
					1,
				);
				assertions++;
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(JSON.stringify({ check: "openlibrary-native-source", assertions, rolledBack: true }));
} finally {
	await pool.end();
}
