import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import {
	authEntity,
	entityParticipation,
	participationGrant,
} from "@rezics/schema/postgres/access/participation";
import { entityPresentation } from "@rezics/schema/postgres/identity/entity-presentation";
import { platformCapabilityGrant } from "@rezics/schema/postgres/realms/realm";
import { operationalCapacity } from "@rezics/schema/postgres/operations/operational-durability";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { createManagedOrganization } from "../src/services/participation/organizations";
import {
	issueParticipationGrant,
	revokeParticipationGrant,
	createServicePrincipal,
	resolveServicePrincipal,
} from "../src/services/participation/commands";
import { eraseOwnAccount } from "../src/services/participation/erasure";
import { recoverEntityController } from "../src/services/participation/lifecycle";
import {
	updateEntityPresentation,
	readEntityPresentationRevision,
	restoreEntityPresentation,
} from "../src/services/participation/presentation";
import {
	runParticipationSavepoint,
	runWithParticipationAuthority,
	requireParticipation,
	ParticipationDenied,
	canAccessCatalog,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import {
	createCatalogIdentity,
	addCatalogName,
	loadCatalogIdentity,
	CatalogAccessDenied,
} from "../src/services/catalog/storage";
import {
	recordCatalogSourceObservation,
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { bindCatalogSourceIdentity } from "../src/services/catalog/source-bindings";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable participation fixture configuration is required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("Participation qualification requires an isolated loopback rezics_atlas target");
const pool = new Pool({ connectionString, max: 8, statement_timeout: 20_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback participation lifecycle fixture");
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}
async function blocked(pid: number) {
	for (let attempt = 0; attempt < 100; attempt++) {
		const result = await pool.query<{ blocked: boolean }>(
			"select cardinality(pg_blocking_pids($1)) > 0 as blocked",
			[pid],
		);
		if (result.rows[0]?.blocked) return;
		await setTimeout(10);
	}
	throw new Error("Expected the competing SQL operation to wait on the protecting row lock");
}
function authority(
	userId: string,
	entity: { id: string; authorizationRevision: number },
): ParticipationAuthority {
	return {
		principal: { kind: "auth", authUserId: userId },
		actingEntityId: entity.id,
		authorizationRevision: entity.authorizationRevision,
	};
}
async function newActor(tx: DatabaseTransaction, label: string) {
	const [account] = await tx
		.insert(users)
		.values({ name: label, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	return { account, self, authority: authority(account.id, self) };
}

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

async function sourceProposal(
	tx: DatabaseTransaction,
	actor: Awaited<ReturnType<typeof newActor>>,
) {
	return runWithParticipationAuthority(actor.authority, async () => {
		const key = {
			source: "vndb",
			objectType: "vn",
			externalId: `participation-${crypto.randomUUID()}`,
		};
		const bucket = aggregateRoutingBucket("source_record", catalogSourceRecordId(key));
		await tx
			.insert(operationalCapacity)
			.values(
				["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
					routingBucket: bucket,
					lane,
					maximumRows: 1000n,
					maximumBytes: 64_000_000n,
				})),
			)
			.onConflictDoNothing();
		const first = await recordCatalogSourceObservation(
			tx,
			await storeCatalogSourcePayload(
				key,
				Buffer.from('{"value":1}'),
				"a".repeat(64),
				null,
				archive,
			),
		);
		const createdNative = await createCatalogIdentity(
			tx,
			{ owner: "reference", shape: "participation-fixture" },
			actor.account.id,
		);
		const native = { owner: createdNative.owner, id: createdNative.id };
		const binding = await bindCatalogSourceIdentity(tx, actor.account.id, {
			sourceRecordId: first.record.id,
			path: "/",
			snapshotId: first.snapshot.id,
			reference: native,
		});
		const next = await recordCatalogSourceObservation(
			tx,
			await storeCatalogSourcePayload(
				key,
				Buffer.from('{"value":2}'),
				"a".repeat(64),
				null,
				archive,
			),
		);
		const proposed = await proposeCatalogSourceAdoption(tx, actor.account.id, {
			sourceRecordId: first.record.id,
			mappingKey: binding.mappingKey,
			snapshotId: next.snapshot.id,
			mappingVersion: "vndb.vn.1",
		});
		assert.equal(proposed.status, "proposed");
		if (proposed.status !== "proposed") throw new Error("Expected an exact source proposal");
		return {
			native,
			scope: {
				sourceRecordId: first.record.id,
				proposalId: proposed.proposal.id,
				reference: native,
			},
			decision: {
				sourceRecordId: first.record.id,
				proposalId: proposed.proposal.id,
				mappingVersion: "vndb.vn.1",
				action: "apply" as const,
				reason: "SQL authority qualification",
			},
		};
	});
}

try {
	// These few committed fixtures are deliberate: separate SQL sessions must observe the same Auth/grant rows.
	// They contain dummy identities and remain confined to the disposable target until its next reset.
	const email = `${crypto.randomUUID()}@example.invalid`;
	const [raceAccount] = await database
		.insert(users)
		.values({ name: email, email, emailVerified: true })
		.returning();
	assert.ok(raceAccount);
	const admitted = deferred<void>();
	const releaseAdmission = deferred<void>();
	const competingAdmission = deferred<number>();
	const firstAdmission = database.transaction(async (tx) => {
		const self = await ensureSelfEntityInTransaction(tx, raceAccount);
		admitted.resolve();
		await releaseAdmission.promise;
		return self;
	});
	await Promise.race([admitted.promise, firstAdmission.then(() => undefined)]);
	const secondAdmission = database.transaction(async (tx) => {
		const pid = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
		competingAdmission.resolve(pid.rows[0]!.pid);
		return ensureSelfEntityInTransaction(tx, raceAccount);
	});
	try {
		await blocked(await competingAdmission.promise);
	} finally {
		releaseAdmission.resolve();
	}
	const [firstSelf, secondSelf] = await Promise.all([firstAdmission, secondAdmission]);
	assert.equal(firstSelf.id, secondSelf.id);
	assert.equal(
		firstSelf.name,
		null,
		"A private email supplied as provider display name must not be published",
	);
	const bindings = await database
		.select()
		.from(authEntity)
		.where(eq(authEntity.authUserId, raceAccount.id));
	assert.equal(bindings.length, 1);
	const owner = {
		account: raceAccount,
		self: firstSelf,
		authority: authority(raceAccount.id, firstSelf),
	};
	await assert.rejects(
		database.transaction((tx) =>
			createCatalogIdentity(tx, { owner: "reference", shape: "unscoped-intake" }, owner.account.id),
		),
		ParticipationDenied,
	);
	await assert.rejects(
		database.transaction((tx) =>
			runWithParticipationAuthority(
				{ ...owner.authority, authorizationRevision: owner.authority.authorizationRevision + 1 },
				() =>
					createCatalogIdentity(
						tx,
						{ owner: "reference", shape: "stale-intake" },
						owner.account.id,
					),
			),
		),
		ParticipationDenied,
	);
	const delegate = await database.transaction((tx) => newActor(tx, "Participation SQL delegate"));
	await assert.rejects(
		database.transaction((tx) =>
			runWithParticipationAuthority(owner.authority, () =>
				createCatalogIdentity(
					tx,
					{ owner: "reference", shape: "misattributed-intake" },
					delegate.account.id,
				),
			),
		),
		ParticipationDenied,
	);
	const live = await database.transaction((tx) =>
		runWithParticipationAuthority(owner.authority, async () => {
			const createdNative = await createCatalogIdentity(
				tx,
				{ owner: "reference", shape: "participation-race" },
				owner.account.id,
			);
			const native = { owner: createdNative.owner, id: createdNative.id };
			const grant = await issueParticipationGrant(tx, owner.authority, {
				recipient: { kind: "auth", authUserId: delegate.account.id },
				actingEntityId: delegate.self.id,
				capability: "catalog.edit",
				target: native,
			});
			return { native, grant };
		}),
	);
	const delegated = { ...delegate.authority, grant: live.grant };
	await assert.rejects(
		database.transaction((tx) =>
			runWithParticipationAuthority(delegated, () =>
				createCatalogIdentity(
					tx,
					{ owner: "reference", shape: "unrelated-intake" },
					delegate.account.id,
				),
			),
		),
		ParticipationDenied,
	);
	const effectAdmitted = deferred<void>();
	const releaseEffect = deferred<void>();
	const revokerReady = deferred<number>();
	const effect = database.transaction((tx) =>
		runWithParticipationAuthority(delegated, async () => {
			await requireParticipation(tx, delegated, "catalog.edit", live.native);
			effectAdmitted.resolve();
			await releaseEffect.promise;
			return addCatalogName(tx, live.native, delegate.account.id, 1, {
				kind: "alias",
				languageTag: "en",
				value: "Effect serialized before revocation",
			});
		}),
	);
	await Promise.race([effectAdmitted.promise, effect.then(() => undefined)]);
	const revocation = database.transaction(async (tx) => {
		const pid = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
		revokerReady.resolve(pid.rows[0]!.pid);
		return revokeParticipationGrant(tx, owner.authority, live.grant.id, live.grant.revision);
	});
	try {
		await blocked(await revokerReady.promise);
	} finally {
		releaseEffect.resolve();
	}
	await Promise.all([effect, revocation]);
	await assert.rejects(
		database.transaction((tx) => requireParticipation(tx, delegated, "catalog.edit", live.native)),
		ParticipationDenied,
	);
	console.log(
		"Participation SQL: concurrent self admission and revocation/effect serialization passed.",
	);

	const committedSource = await database.transaction(async (tx) => {
		const proposal = await sourceProposal(tx, owner);
		const grant = await issueParticipationGrant(tx, owner.authority, {
			recipient: { kind: "auth", authUserId: delegate.account.id },
			actingEntityId: delegate.self.id,
			capability: "proposal.adopt",
			target: proposal.native,
			proposal: {
				sourceRecordId: proposal.scope.sourceRecordId,
				proposalId: proposal.scope.proposalId,
			},
		});
		return { proposal, grant };
	});

	try {
		await database.transaction(async (tx) => {
			await assert.rejects(
				loadCatalogIdentity(tx, live.native, owner.account.id, true),
				CatalogAccessDenied,
			);
			const human = await newActor(tx, "Participation erasure fixture");
			const organization = await runWithParticipationAuthority(human.authority, () =>
				createManagedOrganization(tx, human.authority, {
					name: "Managed SQL organization",
					language: "en",
				}),
			);
			const metadataSubject = await runWithParticipationAuthority(owner.authority, () =>
				createCatalogIdentity(tx, { owner: "entity", shape: "person" }, owner.account.id),
			);
			assert.equal(
				(await tx.select().from(authEntity).where(eq(authEntity.entityId, metadataSubject.id)))
					.length,
				0,
			);
			await updateEntityPresentation(tx, human.authority, {
				language: "en",
				expectedRevision: 1,
				name: "First public presentation",
				summary: "Original summary",
			});
			const before = await readEntityPresentationRevision(tx, human.authority, "en", 2);
			await updateEntityPresentation(tx, human.authority, {
				language: "en",
				expectedRevision: 2,
				name: "Second public presentation",
				summary: "Changed summary",
			});
			await restoreEntityPresentation(tx, human.authority, {
				language: "en",
				revision: 2,
				expectedRevision: 3,
			});
			const [restored] = await tx
				.select()
				.from(entityPresentation)
				.where(
					and(
						eq(entityPresentation.entityId, human.self.id),
						eq(entityPresentation.language, "en"),
					),
				);
			assert.equal(restored?.nameRevision, before.nameRevision);
			assert.equal(restored?.summary, "Original summary");
			assert.equal(
				(await ensureSelfEntityInTransaction(tx, human.account)).name,
				"First public presentation",
				"Session self identity must use the selected immutable name revision",
			);
			await eraseOwnAccount(tx, human.authority);
			await assert.rejects(
				runWithParticipationAuthority(human.authority, () =>
					createCatalogIdentity(
						tx,
						{ owner: "reference", shape: "erased-intake" },
						human.account.id,
					),
				),
				ParticipationDenied,
			);
			assert.equal(
				(await tx.select().from(authEntity).where(eq(authEntity.authUserId, human.account.id)))
					.length,
				0,
			);
			const [closed] = await tx.select().from(users).where(eq(users.id, human.account.id));
			assert.equal(closed?.name, "");
			assert.equal(closed?.image, null);
			assert.ok(closed?.erasedAt);
			const [suspended] = await tx
				.select()
				.from(entityParticipation)
				.where(eq(entityParticipation.entityId, organization.entityId));
			assert.equal(suspended?.state, "recovery_required");
			await assert.rejects(
				tx.transaction((nested) =>
					recoverEntityController(nested, owner.authority, {
						entityId: organization.entityId,
						recipientAuthUserId: delegate.account.id,
						expectedRevision: suspended!.revision,
						evidence: "Unauthorised recovery attempt",
					}),
				),
				ParticipationDenied,
			);
			await tx.insert(platformCapabilityGrant).values({
				authUserId: owner.account.id,
				capability: "platform.access.manage",
				grantedByAuthUserId: owner.account.id,
			});
			const recovered = await recoverEntityController(tx, owner.authority, {
				entityId: organization.entityId,
				recipientAuthUserId: delegate.account.id,
				expectedRevision: suspended!.revision,
				evidence: "Verified replacement controller in isolated SQL fixture",
			});
			await requireParticipation(
				tx,
				{ ...delegate.authority, actingEntityId: organization.entityId, grant: recovered.grant },
				"entity.security",
				{ owner: "entity", id: organization.entityId },
			);
			assert.equal(
				(await tx.select().from(authEntity).where(eq(authEntity.authUserId, human.account.id)))
					.length,
				0,
				"Recovery must not restore private account binding",
			);

			for (const service of [false, true]) {
				const proposal = service ? await sourceProposal(tx, owner) : committedSource.proposal;
				const other = await runWithParticipationAuthority(owner.authority, () =>
					createCatalogIdentity(
						tx,
						{ owner: "reference", shape: "unrelated-fixture" },
						owner.account.id,
					),
				);
				const machine = service
					? await createServicePrincipal(tx, owner.authority, "Source SQL service")
					: undefined;
				const grant = machine
					? await issueParticipationGrant(tx, owner.authority, {
							recipient: machine
								? { kind: "service", servicePrincipalId: machine.id }
								: { kind: "auth", authUserId: delegate.account.id },
							actingEntityId: machine?.entityId ?? delegate.self.id,
							capability: "proposal.adopt",
							target: proposal.native,
							proposal: {
								sourceRecordId: proposal.scope.sourceRecordId,
								proposalId: proposal.scope.proposalId,
							},
						})
					: committedSource.grant;
				const selection = machine
					? await resolveServicePrincipal(tx, machine.secret, grant)
					: { ...delegate.authority, grant };
				if (machine)
					await assert.rejects(
						runWithParticipationAuthority({ ...selection, grant: undefined }, () =>
							createCatalogIdentity(
								tx,
								{ owner: "reference", shape: "service-intake" },
								selection.principal.authUserId,
							),
						),
						ParticipationDenied,
					);
				let callbacks = 0;
				const outcome = await runWithParticipationAuthority(selection, () =>
					decideCatalogSourceProposal(
						tx,
						selection.principal.authUserId,
						proposal.decision,
						async (applying, context) => {
							callbacks++;
							await assert.rejects(
								runWithParticipationAuthority(owner.authority, () =>
									createCatalogIdentity(
										applying,
										{ owner: "reference", shape: "scope-reset-intake" },
										owner.account.id,
									),
								),
								ParticipationDenied,
							);
							await assert.rejects(
								runParticipationSavepoint(applying, (nested) =>
									createCatalogIdentity(
										nested,
										{ owner: "reference", shape: "proposal-intake" },
										selection.principal.authUserId,
									),
								),
								ParticipationDenied,
							);
							await assert.rejects(
								database.transaction((unrelated) =>
									createCatalogIdentity(
										unrelated,
										{ owner: "reference", shape: "cross-transaction-intake" },
										selection.principal.authUserId,
									),
								),
								ParticipationDenied,
							);
							assert.equal(
								await canAccessCatalog(
									applying,
									other,
									selection.principal.authUserId,
									owner.account.id,
									true,
								),
								false,
							);
							await database.transaction(async (unrelated) => {
								assert.equal(
									await canAccessCatalog(
										unrelated,
										proposal.native,
										selection.principal.authUserId,
										owner.account.id,
										true,
									),
									false,
									"Approved scope must not cross into an unrelated transaction",
								);
							});
							return runParticipationSavepoint(applying, (nested) =>
								addCatalogName(nested, context.reference, context.actor, context.expectedRevision, {
									kind: "alias",
									languageTag: "en",
									value: "Exactly approved native source value",
								}),
							);
						},
					),
				);
				assert.equal(outcome.status, "applied");
				assert.equal(callbacks, 1);
				await revokeParticipationGrant(tx, owner.authority, grant.id, grant.revision);
				await assert.rejects(
					requireParticipation(tx, selection, "proposal.adopt", proposal.native, proposal.scope),
					ParticipationDenied,
				);
				const [revoked] = await tx
					.select()
					.from(participationGrant)
					.where(eq(participationGrant.id, grant.id));
				assert.ok(revoked?.revokedAt);
			}
			throw rollback;
		});
	} catch (cause) {
		if (cause !== rollback) throw cause;
	}
	console.log(
		"Participation SQL: presentation restore, last-controller recovery, exact human/service source grants, native savepoints and cross-transaction denial passed.",
	);
	const repository = new URL("../../../", import.meta.url);
	const sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/Taskfile.yml",
		"services/main/scripts/check-participation-authority.ts",
		"services/main/src/services/participation/policy.ts",
		"services/main/src/services/participation/identity.ts",
		"services/main/src/services/catalog/storage.ts",
		"services/main/src/services/catalog/identity-storage.ts",
		"services/main/src/services/participation/commands.ts",
		"services/main/src/services/participation/lifecycle.ts",
		"services/main/src/services/participation/presentation.ts",
		"services/main/src/services/participation/erasure.ts",
		"services/main/src/services/auth/entity.ts",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, repository)))
			.digest("hex");
	const runtime = await pool.query(`select version() as postgres, current_database() as database,
		current_setting('default_transaction_isolation') as default_isolation,
		current_setting('max_connections') as max_connections,
		current_setting('statement_timeout') as statement_timeout`);
	console.info(
		JSON.stringify({
			check: "participation-authority",
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repository),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			platform: `${process.platform}/${process.arch}`,
			runtime: runtime.rows[0],
			qualificationScope:
				"Concurrent self admission, human catalog intake and rejected unscoped/misattributed/stale/delegated/service/proposal intake, delegated effect/revocation serialization, presentation restore, initial account closure and last-controller recovery, exact human/service source grants and transaction-bound denial. Full resource ownership/disclosure, erasure workers and APIs are not qualified by this fixture.",
		}),
	);
} finally {
	await pool.end();
}
