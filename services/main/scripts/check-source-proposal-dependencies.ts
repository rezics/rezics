import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { catalogSourceProposalDependency } from "../src/services/database/schema/catalog-source-dependency";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { issueParticipationGrant } from "../src/services/participation/commands";
import {
	canAccessCatalog,
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	runWithApprovedSourceProposal,
	runWithParticipationAuthority,
	runParticipationSavepoint,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import {
	assertReadableTargets,
	createCatalogIdentity,
	loadCatalogIdentity,
} from "../src/services/catalog/storage";
import {
	bindCatalogSourceIdentity,
	reviseCatalogSourceBinding,
} from "../src/services/catalog/source-bindings";
import { proposeCatalogSourceAdoption } from "../src/services/catalog/source-proposals";
import {
	prepareCatalogSourceProposalDependency,
	revokeCatalogSourceProposalDependency,
} from "../src/services/catalog/source-dependencies";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceDocument,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { aggregateRoutingBucket } from "../src/services/events/envelope";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("Requires an isolated loopback Atlas target");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 }),
	database = drizzle({ client: pool });
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		objects.set(input.Key, input.Body);
	},
	async get(input) {
		const bytes = objects.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
async function actor(tx: DatabaseTransaction, label: string) {
	const [account] = await tx
		.insert(users)
		.values({ name: label, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	const authority: ParticipationAuthority = {
		principal: { kind: "auth", authUserId: account.id },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	return { account, authority };
}
let assertions = 0;
const rollback = new Error("rollback dependency fixture");
try {
	try {
		await database.transaction(async (tx) => {
			const owner = await actor(tx, "Dependency preparer"),
				delegate = await actor(tx, "Dependency reviewer");
			await runWithParticipationAuthority(owner.authority, async () => {
				const rootKey = {
					source: "musicbrainz",
					objectType: "release",
					externalId: crypto.randomUUID(),
				};
				const dependencyKey = {
					source: "musicbrainz",
					objectType: "artist",
					externalId: crypto.randomUUID(),
				};
				for (const key of [rootKey, dependencyKey])
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								routingBucket: aggregateRoutingBucket("source_record", catalogSourceRecordId(key)),
								lane,
								maximumRows: 5000n,
								maximumBytes: 128_000_000n,
							})),
						)
						.onConflictDoNothing();
				const observe = async (key: typeof rootKey, value: unknown) => {
					const bytes = Buffer.from(JSON.stringify(value));
					return recordCatalogSourceDocument(
						tx,
						await storeCatalogSourcePayload(key, bytes, "a".repeat(64), null, archive),
						bytes,
					);
				};
				const first = await observe(rootKey, { artist: dependencyKey.externalId, version: 1 });
				const rootCreated = await createCatalogIdentity(
					tx,
					{ owner: "music", shape: "release" },
					owner.account.id,
				);
				const root = { owner: rootCreated.owner, id: rootCreated.id };
				const rootBinding = await bindCatalogSourceIdentity(tx, owner.account.id, {
					sourceRecordId: first.record.id,
					path: "/",
					snapshotId: first.snapshot.id,
					reference: root,
				});
				const observedDependency = await observe(dependencyKey, { id: dependencyKey.externalId });
				const childCreated = await createCatalogIdentity(
					tx,
					{ owner: "entity", shape: "person" },
					owner.account.id,
				);
				const child = { owner: childCreated.owner, id: childCreated.id };
				const childBinding = await bindCatalogSourceIdentity(tx, owner.account.id, {
					sourceRecordId: observedDependency.record.id,
					path: "/",
					snapshotId: observedDependency.snapshot.id,
					reference: child,
				});
				const unrelatedCreated = await createCatalogIdentity(
					tx,
					{ owner: "entity", shape: "person" },
					owner.account.id,
				);
				const unrelated = { owner: unrelatedCreated.owner, id: unrelatedCreated.id };
				const incoming = await observe(rootKey, { artist: dependencyKey.externalId, version: 2 });
				const proposal = await proposeCatalogSourceAdoption(tx, owner.account.id, {
					sourceRecordId: first.record.id,
					mappingKey: rootBinding.mappingKey,
					snapshotId: incoming.snapshot.id,
					mappingVersion: "musicbrainz.release.1",
				});
				if (proposal.status !== "proposed") throw new Error("Expected proposal");
				const scope = {
					sourceRecordId: first.record.id,
					proposalId: proposal.proposal.id,
					reference: root,
				};
				const key = {
					sourceRecordId: scope.sourceRecordId,
					proposalId: scope.proposalId,
					position: 0,
				};
				const input = {
					...key,
					dependencySourceRecordId: observedDependency.record.id,
					evidence: incoming.referenceAt("/artist"),
				};
				const prepared = await prepareCatalogSourceProposalDependency(tx, owner.account.id, input);
				assert.deepEqual(prepared.reference, child);
				assertions++;
				assert.deepEqual(
					await prepareCatalogSourceProposalDependency(tx, owner.account.id, input),
					prepared,
				);
				assertions++;
				await assert.rejects(
					() =>
						prepareCatalogSourceProposalDependency(tx, owner.account.id, {
							...input,
							evidence: first.referenceAt("/artist"),
						}),
					/exact pending/,
				);
				assertions++;
				await assert.rejects(() =>
					prepareCatalogSourceProposalDependency(tx, owner.account.id, { ...input, position: 128 }),
				);
				assertions++;
				const grant = await issueParticipationGrant(tx, owner.authority, {
					recipient: { kind: "auth", authUserId: delegate.account.id },
					actingEntityId: delegate.authority.actingEntityId,
					capability: "proposal.adopt",
					target: root,
					proposal: { sourceRecordId: scope.sourceRecordId, proposalId: scope.proposalId },
				});
				const selected = { ...delegate.authority, grant };
				const ownGrant = await issueParticipationGrant(tx, owner.authority, {
					recipient: { kind: "auth", authUserId: owner.account.id },
					actingEntityId: owner.authority.actingEntityId,
					capability: "proposal.adopt",
					target: root,
					proposal: { sourceRecordId: scope.sourceRecordId, proposalId: scope.proposalId },
				});
				const ownSelected = { ...owner.authority, grant: ownGrant };
				await runWithParticipationAuthority(ownSelected, () =>
					runWithApprovedSourceProposal(tx, ownSelected, scope, async () => {
						const readScope = await readCatalogAuthorityScope(tx, owner.account.id);
						assert.equal(readScope.creatorAuthUserId, null);
						assertions++;
						const identities = CatalogIdentityTables.entity;
						const visible = await tx
							.select({ id: identities.id })
							.from(identities)
							.where(
								and(
									inArray(identities.id, [child.id, unrelated.id]),
									catalogIdentityReadPredicate(readScope, "entity", identities),
								),
							);
						assert.deepEqual(visible, [{ id: child.id }]);
						assertions++;
						assert.equal(
							(await assertReadableTargets(tx, [child], owner.account.id)).get(
								`entity:${child.id}`,
							),
							"person",
						);
						assertions++;
						await assert.rejects(
							() => assertReadableTargets(tx, [unrelated], owner.account.id),
							/not readable/,
						);
						assertions++;
					}),
				);
				const allowed = (nested: DatabaseTransaction, ref: typeof child, write = false) =>
					canAccessCatalog(nested, ref, delegate.account.id, owner.account.id, write);
				await runWithParticipationAuthority(selected, async () => {
					assert.equal(await allowed(tx, child), false);
					assertions++;
					await runWithApprovedSourceProposal(tx, selected, scope, async () => {
						assert.equal(await allowed(tx, root, true), true);
						assertions++;
						assert.equal(await allowed(tx, child), true);
						assertions++;
						assert.equal(
							(await loadCatalogIdentity(tx, child, delegate.account.id, false)).id,
							child.id,
						);
						assertions++;
						assert.equal(await allowed(tx, child, true), false);
						assertions++;
						assert.equal(await allowed(tx, unrelated), false);
						assertions++;
						await runParticipationSavepoint(tx, async (nested) => {
							assert.equal(await allowed(nested, child), true);
							assertions++;
							assert.equal(await allowed(nested, child, true), false);
							assertions++;
						});
					});
				});
				await assert.rejects(
					tx.transaction((nested) =>
						nested.insert(catalogSourceProposalDependency).values({
							sourceRecordId: key.sourceRecordId,
							proposalId: key.proposalId,
							position: 2,
							snapshotId: incoming.snapshot.id,
							sourcePath: "/artist",
							dependencySourceRecordId: observedDependency.record.id,
							dependencyMappingKey: childBinding.mappingKey,
							dependencyBindingRevision: 1,
							entityId: unrelated.id,
							preparedByAuthUserId: owner.account.id,
						}),
					),
				);
				assertions++;
				await assert.rejects(
					tx.transaction((nested) =>
						nested
							.delete(catalogSourceProposalDependency)
							.where(eq(catalogSourceProposalDependency.sourceRecordId, key.sourceRecordId)),
					),
				);
				assertions++;
				await revokeCatalogSourceProposalDependency(tx, owner.account.id, key);
				await runWithParticipationAuthority(selected, () =>
					runWithApprovedSourceProposal(tx, selected, scope, async () => {
						assert.equal(await allowed(tx, child), false);
						assertions++;
					}),
				);
				await assert.rejects(
					() => prepareCatalogSourceProposalDependency(tx, owner.account.id, input),
					/revoked/,
				);
				assertions++;
				await prepareCatalogSourceProposalDependency(tx, owner.account.id, {
					...input,
					position: 1,
				});
				await reviseCatalogSourceBinding(tx, owner.account.id, {
					sourceRecordId: observedDependency.record.id,
					mappingKey: childBinding.mappingKey,
					expectedRevision: 1,
					state: "paused",
					mode: "review",
					reason: "Dependency moved after intake",
				});
				await runWithParticipationAuthority(selected, () =>
					runWithApprovedSourceProposal(tx, selected, scope, async () => {
						assert.equal(await allowed(tx, child), false);
						assertions++;
					}),
				);
				await tx.execute(sql`set constraints all immediate`);
				throw rollback;
			});
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({ check: "source-proposal-dependencies", assertions, rolledBack: true }),
	);
} finally {
	await pool.end();
}
