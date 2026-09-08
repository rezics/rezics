import { and, eq } from "drizzle-orm";
import { CatalogReferenceSchema, type CatalogReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogNameInputSchema } from "../catalog/name-contracts";
import {
	createCatalogIdentity,
	loadCatalogIdentity,
	addCatalogName,
	ensureCatalogDefinition,
	createCatalogRelation,
	beginCatalogFact,
	appendCatalogFactNodes,
	sealCatalogFact,
} from "../catalog/storage";
import { reviseCatalogName } from "../catalog/names";
import { initializeEntityProfile } from "../catalog/entities";
import { updatePublishingStructure, putPublishingCoverage } from "../catalog/publishing";
import { updateProgramStructure } from "../catalog/program";
import {
	reviseSoftwareContent,
	createSoftwareVersion,
	createNativeSoftwareRelease,
	appendSoftwareReleaseComponents,
} from "../catalog/software";
import { createPublication, createPublishingWork } from "../catalog/domains";
import { updateCatalogLifecycle } from "../catalog/resources";
import {
	assignGroupingClass,
	createGroupingOrderProfile,
	orderGroupingRelation,
} from "../catalog/grouping";
import { catalogValueNodes } from "../catalog/value-nodes";
import { fractionalPositionAt } from "../ordering/position";
import { SeedPlan } from "./data";
import { withSeedAuthority, type SeedIdentityDescriptor } from "./identity";

export type PreparedSeedIdentity = SeedIdentityDescriptor & { readonly id: string };

/** Catalog fixtures are cataloged subjects. This never enrolls them as accounts or controlled participants. */
export async function materializeCatalogFixtures(
	tx: DatabaseTransaction,
	rows: readonly PreparedSeedIdentity[],
): Promise<void> {
	for (const [index, row] of rows.entries())
		await withSeedAuthority(tx, row.ownerProfileId, async (authority) => {
			const reference = CatalogReferenceSchema.parse({ owner: row.kind, id: row.id });
			const actor = authority.principal.authUserId;
			const shape =
				reference.owner === "publishing"
					? "text_version"
					: reference.owner === "program"
						? "program"
						: reference.owner === "software"
							? "content"
							: reference.owner === "grouping"
								? "grouping"
								: index < 45
									? "person"
									: index < 65
										? "organization"
										: "character";
			const identity = await createCatalogIdentity(
				tx,
				{
					...reference,
					shape,
					status: row.status,
					visibility: row.visibility,
					moderationStatus: row.moderationStatus,
				},
				actor,
			);
			switch (reference.owner) {
				case "entity":
					await initializeEntityProfile(tx, reference, actor, identity.revision, {});
					break;
				case "publishing":
					await updatePublishingStructure(tx, reference, actor, identity.revision, {
						shape: "text_version",
						fields: { languageTag: "en" },
					});
					break;
				case "program":
					await updateProgramStructure(tx, reference, actor, identity.revision, {
						shape: "program",
						fields: {
							declaredMainEpisodeCount: 1 + (index % 48),
							declaredTotalEpisodeCount: 1 + (index % 48),
						},
					});
					break;
				case "software":
					await reviseSoftwareContent(tx, reference, actor, identity.revision, {
						developmentStatus: "finished",
					});
					break;
				case "grouping": {
					const groupClass = await ensureCatalogDefinition(tx, {
						namespace: "seed.catalog",
						key: ["franchise", "publishing-series", "software-series", "program-series"][
							index % 4
						]!,
						kind: "class",
						valueKind: null,
						constraints: { targets: [{ owner: "grouping", shapes: ["grouping"] }] },
					});
					await assignGroupingClass(tx, reference, actor, identity.revision, groupClass.revisionId);
					break;
				}
				default:
					throw new Error(`Unsupported synthetic catalog owner ${reference.owner}`);
			}
		});
}

export async function writeSeedCatalogNames(
	tx: DatabaseTransaction,
	row: PreparedSeedIdentity,
	names: readonly { language: string; title: string | null | undefined }[],
): Promise<void> {
	const reference = CatalogReferenceSchema.parse({ owner: row.kind, id: row.id });
	await withSeedAuthority(tx, row.ownerProfileId, async (authority) => {
		const actor = authority.principal.authUserId;
		let revision = (await loadCatalogIdentity(tx, reference, actor, true)).revision;
		for (const name of names) {
			if (!name.title) continue;
			const table = CatalogNameTables[reference.owner].name;
			const [existing] = await tx
				.select({ id: table.id, revision: table.revision })
				.from(table)
				.where(
					and(
						eq(table.ownerId, row.id),
						eq(table.languageTag, name.language),
						eq(table.kind, "primary"),
					),
				)
				.limit(1);
			const input = {
				kind: "primary",
				languageTag: name.language,
				value: name.title,
				primaryForLanguage: true,
			};
			if (existing)
				await reviseCatalogName(tx, reference, actor, existing.id, existing.revision, input);
			else revision = (await addCatalogName(tx, reference, actor, revision, input)).revision;
		}
	});
}

/** Exercises native immutable name revisions; platform history never snapshots catalog identities. */
export async function seedCatalogNameHistory(
	tx: DatabaseTransaction,
	rows: readonly PreparedSeedIdentity[],
	restoreCount: number,
): Promise<void> {
	for (const [index, row] of rows.entries())
		await withSeedAuthority(tx, row.ownerProfileId, async (authority) => {
			const reference: CatalogReference = CatalogReferenceSchema.parse({
				owner: row.kind,
				id: row.id,
			});
			const table = CatalogNameTables[reference.owner].name;
			const [name] = await tx
				.select()
				.from(table)
				.where(eq(table.ownerId, row.id))
				.orderBy(table.id)
				.limit(1);
			if (!name) throw new Error("Native fixture has no named form");
			const original = CatalogNameInputSchema.parse(
				Object.fromEntries(
					Object.keys(CatalogNameInputSchema.shape).map((key) => [key, Reflect.get(name, key)]),
				),
			);
			const updated = await reviseCatalogName(
				tx,
				reference,
				authority.principal.authUserId,
				name.id,
				name.revision,
				{ ...original, value: `${name.value} 2` },
			);
			if (index < restoreCount)
				await reviseCatalogName(
					tx,
					reference,
					authority.principal.authUserId,
					name.id,
					updated.revision,
					original,
				);
		});
}

async function firstName(tx: DatabaseTransaction, reference: CatalogReference) {
	const table = CatalogNameTables[reference.owner].name;
	const [name] = await tx
		.select({ value: table.value, languageTag: table.languageTag })
		.from(table)
		.where(and(eq(table.ownerId, reference.id), eq(table.kind, "primary")))
		.orderBy(table.id)
		.limit(1);
	if (!name) throw new Error("Native fixture requires a primary named form");
	return name;
}

/** Explicit synthetic examples exercise actual native layers without reusing a generic Variant identity. */
export async function seedNativeFixtureStructures(
	tx: DatabaseTransaction,
	input: {
		books: readonly PreparedSeedIdentity[];
		software: readonly PreparedSeedIdentity[];
		programs: readonly PreparedSeedIdentity[];
		groupings: readonly PreparedSeedIdentity[];
	},
): Promise<void> {
	for (const [index, book] of input.books.entries())
		await withSeedAuthority(tx, book.ownerProfileId, async (authority) => {
			const actor = authority.principal.authUserId,
				reference = CatalogReferenceSchema.parse({ owner: book.kind, id: book.id });
			const name = await firstName(tx, reference);
			const work = await createPublishingWork(tx, actor, name);
			const publication = await createPublication(tx, actor, {
				name,
				pageCount: 80 + ((index * 37) % 900),
			});
			await updateCatalogLifecycle(tx, work, actor, {
				expectedRevision: work.revision,
				status: book.status,
				visibility: book.visibility,
				contentRating: "general",
			});
			const publicationState = await updateCatalogLifecycle(tx, publication, actor, {
				expectedRevision: publication.revision,
				status: book.status,
				visibility: book.visibility,
				contentRating: "general",
			});
			await putPublishingCoverage(
				tx,
				reference,
				actor,
				(await loadCatalogIdentity(tx, reference, actor, true)).revision,
				{ kind: "text_work", targetId: work.id, position: 0 },
			);
			await putPublishingCoverage(tx, publication, actor, publicationState.revision, {
				kind: "publication_text",
				targetId: book.id,
				position: 0,
			});
		});
	for (const [index, content] of input.software.slice(0, SeedPlan.softwareVersions).entries())
		await withSeedAuthority(tx, content.ownerProfileId, async (authority) => {
			const reference = CatalogReferenceSchema.parse({ owner: content.kind, id: content.id });
			const name = await firstName(tx, reference);
			const version = await createSoftwareVersion(tx, authority.principal.authUserId, {
				content: reference,
				name: { ...name, value: `${name.value} ${index + 1}.0` },
				details: {
					kind: "revision",
					versionLabel: `${index + 1}.0`,
					distinguishingEvidence: "Adds controller input and offline saves.",
				},
			});
			await updateCatalogLifecycle(tx, version, authority.principal.authUserId, {
				expectedRevision: version.revision,
				status: content.status,
				visibility: content.visibility,
				contentRating: "general",
			});
		});
	const member = await ensureCatalogDefinition(tx, {
		namespace: "seed.catalog",
		key: "member",
		kind: "role",
		valueKind: null,
	});
	const predicate = await ensureCatalogDefinition(tx, {
		namespace: "seed.catalog",
		key: "grouping-membership",
		kind: "predicate",
		valueKind: null,
		constraints: {
			roles: [
				{
					roleRevisionId: member.revisionId,
					min: 1,
					max: 1,
					targets: [
						{ owner: "publishing", shapes: ["text_version"] },
						{ owner: "software", shapes: ["content"] },
						{ owner: "program", shapes: ["program"] },
					],
				},
			],
		},
	});
	const targets = [...input.books, ...input.software, ...input.programs].filter(
		(row) =>
			row.status === "published" &&
			row.visibility === "public" &&
			row.moderationStatus === "approved",
	);
	if (!targets.length) throw new Error("Grouping fixture requires public native members");
	for (const [groupIndex, group] of input.groupings.entries())
		await withSeedAuthority(tx, group.ownerProfileId, async (authority) => {
			const reference = CatalogReferenceSchema.parse({ owner: group.kind, id: group.id }),
				actor = authority.principal.authUserId;
			let revision = (await loadCatalogIdentity(tx, reference, actor, true)).revision;
			const order = await createGroupingOrderProfile(
				tx,
				reference,
				actor,
				revision,
				"reading-order",
			);
			revision = order.revision;
			const count = Math.min(6, targets.length);
			for (let ordinal = 0; ordinal < count; ordinal++) {
				const target = targets[(groupIndex * 6 + ordinal) % targets.length]!;
				const relation = await createCatalogRelation(tx, reference, actor, revision, {
					definitionRevisionId: predicate.revisionId,
					participants: [
						{
							roleRevisionId: member.revisionId,
							target: CatalogReferenceSchema.parse({ owner: target.kind, id: target.id }),
						},
					],
				});
				revision = relation.revision;
				revision = (
					await orderGroupingRelation(tx, reference, actor, revision, {
						profileId: order.id,
						relationId: relation.id,
						position: fractionalPositionAt(ordinal),
					})
				).revision;
			}
		});
	const requirements = await ensureCatalogDefinition(tx, {
		namespace: "seed.catalog",
		key: "system-requirements",
		kind: "property",
		valueKind: "object",
		constraints: {
			targets: [{ owner: "software", shapes: ["content"] }],
			rules: [
				{ position: 0, parent: null, memberKey: null, kind: "object" },
				{
					position: 1,
					parent: 0,
					memberKey: "tier",
					kind: "string",
					allowedValues: ["minimum", "recommended"],
				},
				{
					position: 2,
					parent: 0,
					memberKey: "memoryGiB",
					kind: "number",
					integer: true,
					minimum: 1,
					maximum: 1024,
					unit: "GiB",
				},
				{
					position: 3,
					parent: 0,
					memberKey: "storageGiB",
					kind: "number",
					integer: true,
					minimum: 1,
					maximum: 16384,
					unit: "GiB",
				},
			],
		},
	});
	for (const [index, content] of input.software.entries())
		await withSeedAuthority(tx, content.ownerProfileId, async (authority) => {
			const reference = CatalogReferenceSchema.parse({ owner: content.kind, id: content.id }),
				actor = authority.principal.authUserId;
			let revision = (await loadCatalogIdentity(tx, reference, actor, true)).revision;
			for (const tier of ["minimum", "recommended"] as const) {
				const nodes = [
					...catalogValueNodes({
						tier,
						memoryGiB: tier === "minimum" ? 8 : 16,
						storageGiB: 40 + (index % 8) * 10,
					}),
				];
				const started = await beginCatalogFact(
					tx,
					reference,
					actor,
					revision,
					requirements.revisionId,
				);
				const appended = await appendCatalogFactNodes(
					tx,
					reference,
					actor,
					started.revision,
					started.id,
					-1,
					nodes,
				);
				revision = (
					await sealCatalogFact(
						tx,
						reference,
						actor,
						appended.revision,
						started.id,
						nodes.length - 1,
					)
				).revision;
			}
		});
}

export async function seedNativeReleaseFixture(
	tx: DatabaseTransaction,
	content: PreparedSeedIdentity,
): Promise<void> {
	await withSeedAuthority(tx, content.ownerProfileId, async (authority) => {
		const actor = authority.principal.authUserId,
			reference = CatalogReferenceSchema.parse({ owner: content.kind, id: content.id });
		const name = await firstName(tx, reference);
		const release = await createNativeSoftwareRelease(tx, actor, {
			name: { ...name, value: `${name.value} 1.0.0` },
		});
		const releaseState = await updateCatalogLifecycle(tx, release, actor, {
			expectedRevision: release.revision,
			status: content.status,
			visibility: content.visibility,
			contentRating: "general",
		});
		await appendSoftwareReleaseComponents(tx, release, actor, releaseState.revision, [
			{ kind: "content", contentId: content.id },
		]);
	});
}
