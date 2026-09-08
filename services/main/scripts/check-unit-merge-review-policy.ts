import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { initializeObservability } from "@rezics/observability";
import { OfficialRealmUnitIds } from "@rezics/slug";
import type { CatalogReference } from "@rezics/reference";
import type { Authorization } from "../src/services/authorization";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";
import type { CatalogSourceArchive } from "../src/services/catalog/source-observations";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("DATABASE_URL and REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 are required");
const target = new URL(connectionString);
const databaseName = target.pathname.replace(/^\//u, "");
const exactNativeApi =
	target.port === "25435" && databaseName === "rezics_atlas_native_api_20260908";
const atlasDisposable = /^rezics_atlas(?:_[a-z0-9_]+)?$/u.test(databaseName);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port === "15432" ||
	!(exactNativeApi || atlasDisposable)
)
	throw new Error(
		"Merge policy fixtures require loopback port 25435 database rezics_atlas_native_api_20260908 or an isolated rezics_atlas* disposable target; never port 15432",
	);

const observability = initializeObservability({
	service: {
		name: "rezics-unit-merge-review-policy-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});

const { database } = await import("../src/services/database");
type MergeFixtureTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
const { auth } = await import("../src/services/auth");
const { users, sessions } = await import("../src/services/database/schema/auth");
const { platformCapabilityGrant, realmRule, realmRuleRevision } = await import(
	"../src/services/database/schema/realm"
);
const { CatalogIdentityTables } = await import("../src/services/database/schema/catalog-identity");
const { CatalogNameTables } = await import("../src/services/database/schema/catalog-names");
const { CatalogFactTables } = await import("../src/services/database/schema/catalog-facts");
const {
	catalogSourceMappingClaim,
	catalogSourceBindingRevision,
} = await import("../src/services/database/schema/catalog-source");
const { unitMergeOperation, unitMergeGraphLock, unitMergeRedirect } = await import(
	"../src/services/database/schema/unit-merge"
);
const { ensureSelfEntityInTransaction } = await import("../src/services/auth/entity");
const { Authorization: AuthorizationService } = await import("../src/services/authorization");
const { runWithParticipationAuthority, ParticipationDenied } = await import(
	"../src/services/participation/policy"
);
const { withCatalogViewerPolicy } = await import("../src/services/catalog/read-policy");
const { createServicePrincipal } = await import("../src/services/participation/commands");
const {
	createCatalogIdentity,
	loadCatalogIdentity,
	ensureCatalogDefinition,
	CatalogAccessDenied,
	CatalogReferenceNotFound,
	CatalogRevisionConflict,
} = await import("../src/services/catalog/storage");
const { addCatalogName } = await import("../src/services/catalog/names");
const { addCatalogIdentifier } = await import("../src/services/catalog/identifiers");
const { writeCatalogApiFact } = await import("../src/services/catalog/semantic-api");
const { catalogValueNodes } = await import("../src/services/catalog/value-nodes");
const { storeCatalogSourcePayload, recordCatalogSourceObservation } = await import(
	"../src/services/catalog/source-observations"
);
const {
	bindCatalogSourceIdentity,
	lockCatalogSourceBinding,
	reviseCatalogSourceBinding,
} = await import("../src/services/catalog/source-bindings");
const {
	preflightUnitMerge,
	createReviewedUnitMerge,
	reviewUnitMerge,
	getUnitMergeRequest,
	listMergeReconciliationItems,
} = await import("../src/services/units/merge/service");
const {
	claimUnitMergeOperations,
	processClaimedUnitMergePage,
	dispatchUnitMergeBatch,
	resolveMergeReconciliationItem,
} = await import("../src/services/units/merge/worker");
const { listMergedCatalogSources } = await import("../src/services/units/merge/public-sources");
const { DefaultMergePlan } = await import("../src/services/units/merge/contracts");
const {
	UnitMergeReviewSelfForbidden,
	UnitMergeReviewDuplicate,
	UnitMergeReviewFingerprintMismatch,
	UnitMergeManifestStale,
	UnitMergeKindIneligible,
	UnitMergeKindMismatch,
	UnitMergeConfirmationInvalid,
	UnitMergeIdempotencyConflict,
} = await import("../src/services/api/governance/errors");
const { PlatformCapabilityRequired } = await import("../src/services/authorization/errors");
const { ValidationError } = await import("../src/services/api/errors");
const { UnitNotFound } = await import("../src/services/units/errors");
const { serializeSignedCookie } = await import("better-call");

const context = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
type FixtureAuthority = {
	principal:
		| { kind: "auth"; authUserId: string }
		| { kind: "service"; servicePrincipalId: string; authUserId: string };
	actingEntityId: string;
	authorizationRevision: number;
};
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

type Person = {
	account: { id: string };
	self: { id: string; authorizationRevision: number };
	authority: FixtureAuthority;
	authorization: Authorization<string>;
};

function counted(ok: boolean) {
	assert.equal(ok, true);
	assertions++;
}

async function rejects(work: () => Promise<unknown>, error: new (...args: never[]) => Error) {
	await assert.rejects(work, error);
	assertions++;
}

async function human(label: string): Promise<Person> {
	const person = await database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({
				name: label,
				email: `${crypto.randomUUID()}@example.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(account);
		const self = await ensureSelfEntityInTransaction(tx, account);
		const authority: FixtureAuthority = {
			principal: { kind: "auth", authUserId: account.id },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		};
		return { account, self, authority };
	});
	accounts.push(person.account.id);
	const session = await context.internalAdapter.createSession(person.account.id);
	assert.ok(session.token);
	const [cookie] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			session.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return {
		...person,
		authorization: new AuthorizationService(person.self.id, person.account.id, person.authority),
	};
}

async function grant(
	person: Person,
	capability: "unit.merge.propose" | "unit.merge.review" | "unit.merge",
	grantedBy = person,
) {
	const [row] = await database
		.insert(platformCapabilityGrant)
		.values({
			authUserId: person.account.id,
			capability,
			grantedByAuthUserId: grantedBy.account.id,
		})
		.returning({ id: platformCapabilityGrant.id });
	assert.ok(row);
	assertions++;
}

async function asActor<T>(
	person: Person,
	work: (tx: MergeFixtureTransaction) => Promise<T>,
): Promise<T> {
	return database.transaction((tx) =>
		runWithParticipationAuthority(person.authority, () =>
			withCatalogViewerPolicy(tx, person.account.id, () => work(tx)),
		),
	);
}

function nameValue(value: string, kind = "primary") {
	return { value, kind, languageTag: "en" as const };
}

async function officialRule() {
	const [rule] = await database
		.select({
			sourceRealmId: realmRuleRevision.realmId,
			revisionId: realmRuleRevision.id,
			ruleId: realmRule.id,
		})
		.from(realmRuleRevision)
		.innerJoin(realmRule, eq(realmRule.revisionId, realmRuleRevision.id))
		.where(eq(realmRuleRevision.realmId, OfficialRealmUnitIds.rule))
		.orderBy(desc(realmRuleRevision.version), realmRule.id)
		.limit(1);
	assert.ok(rule, "Install the official Rule Realm before this fixture");
	return rule;
}

async function publishingWork(
	person: Person,
	title: string,
	input: {
		status?: "draft" | "published";
		visibility?: "public" | "unlisted" | "private";
		contentRating?: "general" | "r15" | "r18";
		shape?: string;
	} = {},
) {
	return asActor(person, async (tx) => {
		const created = await createCatalogIdentity(
			tx,
			{
				owner: "publishing",
				shape: input.shape ?? "work",
				status: input.status ?? "published",
				visibility: input.visibility ?? "public",
				contentRating: input.contentRating ?? "general",
				moderationStatus: "approved",
			},
			person.account.id,
		);
		const named = await addCatalogName(
			tx,
			created,
			person.account.id,
			created.revision,
			nameValue(title),
		);
		return {
			reference: { owner: created.owner, id: created.id } satisfies CatalogReference,
			revision: named.revision,
			nameId: named.id,
			nameRevision: named.nameRevision,
			title,
		};
	});
}

async function attachIdentifier(person: Person, reference: CatalogReference, value: string) {
	return asActor(person, async (tx) => {
		const row = await loadCatalogIdentity(tx, reference, person.account.id, true);
		return addCatalogIdentifier(tx, reference, person.account.id, row.revision, {
			namespace: "fixture.merge",
			value,
		});
	});
}

async function attachFact(
	person: Person,
	reference: CatalogReference,
	definitionRevisionId: string,
	value: string,
) {
	return asActor(person, async (tx) => {
		const row = await loadCatalogIdentity(tx, reference, person.account.id, true);
		return writeCatalogApiFact(tx, reference, person.account.id, {
			expectedRevision: row.revision,
			definitionRevisionId,
			nodes: [...catalogValueNodes(value)],
		});
	});
}

async function attachBinding(person: Person, reference: CatalogReference) {
	return asActor(person, async (tx) => {
		const key = {
			source: "vndb",
			objectType: "vn",
			externalId: `merge-fixture-${crypto.randomUUID()}`,
		};
		const routingBucket=aggregateRoutingBucket("source_record",catalogSourceRecordId(key));
		await tx.insert(operationalCapacity).values(["event-outbox","task-outbox","task-intent","receipt"].map(lane=>({routingBucket,lane,maximumRows:10000n,maximumBytes:128_000_000n}))).onConflictDoNothing();
		const observed = await recordCatalogSourceObservation(
			tx,
			await storeCatalogSourcePayload(
				key,
				Buffer.from(JSON.stringify({ title: reference.id })),
				"a".repeat(64),
				null,
				archive,
			),
		);
		const bound = await bindCatalogSourceIdentity(tx, person.account.id, {
			sourceRecordId: observed.record.id,
			path: "/",
			snapshotId: observed.snapshot.id,
			reference,
		});
		return {
			sourceRecordId: observed.record.id,
			snapshotId: observed.snapshot.id,
			mappingKey: bound.mappingKey,
			bindingRevision: bound.bindingRevision ?? 1,
		};
	});
}

async function identityRow(id: string) {
	const [row] = await database
		.select({
			id: CatalogIdentityTables.publishing.id,
			status: CatalogIdentityTables.publishing.status,
			visibility: CatalogIdentityTables.publishing.visibility,
			revision: CatalogIdentityTables.publishing.revision,
			contentRating: CatalogIdentityTables.publishing.contentRating,
			createdAt: CatalogIdentityTables.publishing.createdAt,
		})
		.from(CatalogIdentityTables.publishing)
		.where(eq(CatalogIdentityTables.publishing.id, id))
		.limit(1);
	assert.ok(row);
	return row;
}

async function propose(
	person: Person,
	source: CatalogReference,
	target: CatalogReference,
	rules: Awaited<ReturnType<typeof officialRule>>[],
	idempotencyKey = crypto.randomUUID(),
) {
	const manifest = await preflightUnitMerge(person.authorization, {
		sourceUnitId: source.id,
		targetUnitId: target.id,
		plan: DefaultMergePlan,
	});
	return createReviewedUnitMerge(person.authorization, {
		sourceUnitId: source.id,
		targetUnitId: target.id,
		plan: DefaultMergePlan,
		confirmationSourceUnitId: source.id,
		confirmationTargetUnitId: target.id,
		expectedSourceRevision: manifest.sourceRevision,
		expectedTargetRevision: manifest.targetRevision,
		requestFingerprint: manifest.fingerprint,
		idempotencyKey,
		rules,
	});
}

async function reconcile(maximum = 256) {
	let rounds = 0;
	for (; rounds < maximum; rounds++) {
		if ((await dispatchUnitMergeBatch()) === 0) break;
	}
	return rounds;
}

async function operationFor(requestId: string) {
	const [row] = await database
		.select()
		.from(unitMergeOperation)
		.where(eq(unitMergeOperation.requestId, requestId))
		.limit(1);
	return row ?? null;
}

async function drainUntilBindings(requestId: string) {
	for (let round = 0; round < 64; round++) {
		const current = await operationFor(requestId);
		if (current?.phase === "bindings" && current.state === "pending") return current;
		if (current?.phase === "bindings")
			throw new Error("Bindings phase was claimed before the stale-binding lock");
		const claimed = await claimUnitMergeOperations(new Date(), 1);
		if (!claimed.length) {
			await setTimeout(20);
			continue;
		}
		for (const operation of claimed) await processClaimedUnitMergePage(operation);
	}
	throw new Error("Bindings phase was not reached");
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}

async function waiter(blockerPid: number) {
	for (let attempt = 0; attempt < 200; attempt++) {
		const result = await database.execute<{ pid: number }>(
			sql`select pid from pg_stat_activity where ${blockerPid} = any(pg_blocking_pids(pid))`,
		);
		if (result.rows[0]) return;
		await setTimeout(10);
	}
	throw new Error("Expected the merge worker to wait on the source binding lock");
}

try {
	const rule = await officialRule();
	// Prior interrupted fixture runs may leave admitted jobs; finish due work through the real worker before asserting queue order.
	await reconcile();
	const proposer = await human("Native merge proposer");
	const firstReviewer = await human("Native merge first reviewer");
	const secondReviewer = await human("Native merge second reviewer");
	const stranger = await human("Native merge stranger");
	await grant(proposer, "unit.merge");
	await grant(firstReviewer, "unit.merge.review");
	await grant(secondReviewer, "unit.merge.review");

	const factDefinition = await asActor(proposer, (tx) =>
		ensureCatalogDefinition(tx, {
			namespace: `fixture.merge.${crypto.randomUUID()}`,
			key: "label",
			kind: "property",
			valueKind: "string",
			constraints: { minLength: 1, maxLength: 64 },
		}),
	);

	const machine = await asActor(proposer, (tx) =>
		createServicePrincipal(tx, proposer.authority, "Native merge service"),
	);
	await database.insert(platformCapabilityGrant).values((["unit.merge.propose","unit.merge.review"] as const).map(capability=>({
		authUserId: machine.authUserId,
		capability,
		grantedByAuthUserId: proposer.account.id,
	})));
	const serviceAuthorization = new AuthorizationService(machine.entityId, machine.authUserId, {
		principal: {
			kind: "service",
			servicePrincipalId: machine.id,
			authUserId: machine.authUserId,
		},
		actingEntityId: machine.entityId,
		authorizationRevision: machine.revision,
	});

	const source = await publishingWork(proposer, "Native merge source work");
	const target = await publishingWork(proposer, "Native merge target work");
	const originalIdentifier = await attachIdentifier(proposer, source.reference, "source-isbn-1");
	const originalFact = await attachFact(
		proposer,
		source.reference,
		factDefinition.revisionId,
		"retained source fact",
	);
	const originalBinding = await attachBinding(proposer, source.reference);
	const sourceBefore = await identityRow(source.reference.id);
	const sourceNamesBefore = await database
		.select({
			id: CatalogNameTables.publishing.name.id,
			value: CatalogNameTables.publishing.name.value,
			revision: CatalogNameTables.publishing.name.revision,
			state: CatalogNameTables.publishing.name.state,
		})
		.from(CatalogNameTables.publishing.name)
		.where(eq(CatalogNameTables.publishing.name.ownerId, source.reference.id));
	const sourceChangesBefore = await database
		.select({
			version: CatalogFactTables.publishing.change.version,
			operation: CatalogFactTables.publishing.change.operation,
		})
		.from(CatalogFactTables.publishing.change)
		.where(eq(CatalogFactTables.publishing.change.ownerId, source.reference.id));
	counted(sourceNamesBefore.some((row) => row.value === "Native merge source work"));
	counted(originalIdentifier.identifierRevision === 1);
	counted(originalFact.headVersion === 1);
	counted(originalBinding.bindingRevision === 1);

	await rejects(
		() =>
			preflightUnitMerge(stranger.authorization, {
				sourceUnitId: source.reference.id,
				targetUnitId: target.reference.id,
				plan: DefaultMergePlan,
			}),
		PlatformCapabilityRequired,
	);
	await rejects(
		() =>
			preflightUnitMerge(serviceAuthorization, {
				sourceUnitId: source.reference.id,
				targetUnitId: target.reference.id,
				plan: DefaultMergePlan,
			}),
		ParticipationDenied,
	);

	const shapeMismatch = await publishingWork(proposer, "Native merge publication", {
		shape: "publication",
	});
	await rejects(
		() =>
			preflightUnitMerge(proposer.authorization, {
				sourceUnitId: source.reference.id,
				targetUnitId: shapeMismatch.reference.id,
				plan: DefaultMergePlan,
			}),
		UnitMergeKindMismatch,
	);
	const privateMismatch = await publishingWork(proposer, "Native merge private work", {
		visibility: "private",
	});
	await rejects(
		() =>
			preflightUnitMerge(proposer.authorization, {
				sourceUnitId: source.reference.id,
				targetUnitId: privateMismatch.reference.id,
				plan: DefaultMergePlan,
			}),
		UnitMergeKindMismatch,
	);
	const ratingMismatch = await publishingWork(proposer, "Native merge rated work", {
		contentRating: "r15",
	});
	await rejects(
		() =>
			preflightUnitMerge(proposer.authorization, {
				sourceUnitId: source.reference.id,
				targetUnitId: ratingMismatch.reference.id,
				plan: DefaultMergePlan,
			}),
		UnitMergeKindMismatch,
	);
	const draftMismatch = await publishingWork(proposer, "Native merge draft work", {
		status: "draft",
		visibility: "private",
	});
	const draftTarget = await publishingWork(proposer, "Native merge draft target", {
		status: "published",
		visibility: "private",
	});
	await rejects(
		() =>
			preflightUnitMerge(proposer.authorization, {
				sourceUnitId: draftMismatch.reference.id,
				targetUnitId: draftTarget.reference.id,
				plan: DefaultMergePlan,
			}),
		UnitMergeKindMismatch,
	);
	await rejects(
		() =>
			preflightUnitMerge(proposer.authorization, {
				sourceUnitId: proposer.self.id,
				targetUnitId: firstReviewer.self.id,
				plan: DefaultMergePlan,
			}),
		ParticipationDenied,
	);
	const secondMachine=await asActor(proposer,tx=>createServicePrincipal(tx,proposer.authority,"Second controlled merge fixture"));
	await rejects(
		()=>preflightUnitMerge(proposer.authorization,{sourceUnitId:machine.entityId,targetUnitId:secondMachine.entityId,plan:DefaultMergePlan}),
		UnitMergeKindIneligible,
	);

	const privateSource = await publishingWork(proposer, "Native merge private source", {
		visibility: "private",
	});
	const privateTarget = await publishingWork(proposer, "Native merge private target", {
		visibility: "private",
	});
	await grant(stranger, "unit.merge.propose", proposer);
	await rejects(
		() =>
			preflightUnitMerge(stranger.authorization, {
				sourceUnitId: privateSource.reference.id,
				targetUnitId: privateTarget.reference.id,
				plan: DefaultMergePlan,
			}),
		UnitNotFound,
	);

	const staleSource = await publishingWork(proposer, "Native merge stale source");
	const staleTarget = await publishingWork(proposer, "Native merge stale target");
	const staleManifest = await preflightUnitMerge(proposer.authorization, {
		sourceUnitId: staleSource.reference.id,
		targetUnitId: staleTarget.reference.id,
		plan: DefaultMergePlan,
	});
	await asActor(proposer, async (tx) => {
		const row = await loadCatalogIdentity(tx, staleSource.reference, proposer.account.id, true);
		await addCatalogName(
			tx,
			staleSource.reference,
			proposer.account.id,
			row.revision,
			nameValue("Native merge stale extra", "alias"),
		);
	});
	await rejects(
		() =>
			createReviewedUnitMerge(proposer.authorization, {
				sourceUnitId: staleSource.reference.id,
				targetUnitId: staleTarget.reference.id,
				plan: DefaultMergePlan,
				confirmationSourceUnitId: staleSource.reference.id,
				confirmationTargetUnitId: staleTarget.reference.id,
				expectedSourceRevision: staleManifest.sourceRevision,
				expectedTargetRevision: staleManifest.targetRevision,
				requestFingerprint: staleManifest.fingerprint,
				idempotencyKey: crypto.randomUUID(),
				rules: [rule],
			}),
		UnitMergeManifestStale,
	);
	await rejects(
		() =>
			createReviewedUnitMerge(proposer.authorization, {
				sourceUnitId: source.reference.id,
				targetUnitId: target.reference.id,
				plan: DefaultMergePlan,
				confirmationSourceUnitId: target.reference.id,
				confirmationTargetUnitId: source.reference.id,
				expectedSourceRevision: 1,
				expectedTargetRevision: 1,
				requestFingerprint: "a".repeat(64),
				idempotencyKey: crypto.randomUUID(),
				rules: [rule],
			}),
		UnitMergeConfirmationInvalid,
	);

	const currentSource = await identityRow(source.reference.id);
	const currentTarget = await identityRow(target.reference.id);
	const manifest = await preflightUnitMerge(proposer.authorization, {
		sourceUnitId: source.reference.id,
		targetUnitId: target.reference.id,
		plan: DefaultMergePlan,
	});
	counted(manifest.owner === "publishing");
	counted(manifest.shape === "work");
	counted(manifest.status === "published");
	counted(manifest.visibility === "public");
	counted(manifest.plan.retainedAccess === "target_readers");
	counted(manifest.plan.bindings === "rebind_paused");
	counted(manifest.sourceRevision === currentSource.revision);
	counted(manifest.targetRevision === currentTarget.revision);
	const idempotencyKey = crypto.randomUUID();
	const created = await createReviewedUnitMerge(proposer.authorization, {
		sourceUnitId: source.reference.id,
		targetUnitId: target.reference.id,
		plan: DefaultMergePlan,
		confirmationSourceUnitId: source.reference.id,
		confirmationTargetUnitId: target.reference.id,
		expectedSourceRevision: manifest.sourceRevision,
		expectedTargetRevision: manifest.targetRevision,
		requestFingerprint: manifest.fingerprint,
		idempotencyKey,
		rules: [rule],
	});
	counted(created.state === "pending_review");
	counted(created.requiredApprovals === 2);
	counted(created.proposer.entityId === proposer.self.id);
	const replayed = await createReviewedUnitMerge(proposer.authorization, {
		sourceUnitId: source.reference.id,
		targetUnitId: target.reference.id,
		plan: DefaultMergePlan,
		confirmationSourceUnitId: source.reference.id,
		confirmationTargetUnitId: target.reference.id,
		expectedSourceRevision: manifest.sourceRevision,
		expectedTargetRevision: manifest.targetRevision,
		requestFingerprint: manifest.fingerprint,
		idempotencyKey,
		rules: [rule],
	});
	counted(replayed.id === created.id);
	await rejects(
		() =>
			createReviewedUnitMerge(proposer.authorization, {
				sourceUnitId: source.reference.id,
				targetUnitId: target.reference.id,
				plan: DefaultMergePlan,
				confirmationSourceUnitId: source.reference.id,
				confirmationTargetUnitId: target.reference.id,
				expectedSourceRevision: manifest.sourceRevision,
				expectedTargetRevision: manifest.targetRevision,
				requestFingerprint: "b".repeat(64),
				idempotencyKey,
				rules: [rule],
			}),
		UnitMergeIdempotencyConflict,
	);

	await rejects(
		() =>
			reviewUnitMerge(proposer.authorization, created.id, {
				decision: "approve",
				requestFingerprint: manifest.fingerprint,
			}),
		UnitMergeReviewSelfForbidden,
	);
	await rejects(
		() =>
			reviewUnitMerge(serviceAuthorization, created.id, {
				decision: "approve",
				requestFingerprint: manifest.fingerprint,
			}),
		ParticipationDenied,
	);
	await rejects(
		() =>
			reviewUnitMerge(firstReviewer.authorization, created.id, {
				decision: "approve",
				requestFingerprint: "c".repeat(64),
			}),
		UnitMergeReviewFingerprintMismatch,
	);
	const firstVote = await reviewUnitMerge(firstReviewer.authorization, created.id, {
		decision: "approve",
		requestFingerprint: manifest.fingerprint,
	});
	counted(firstVote.state === "pending_review");
	counted(firstVote.approvals === 1);
	await rejects(
		() =>
			reviewUnitMerge(firstReviewer.authorization, created.id, {
				decision: "approve",
				requestFingerprint: manifest.fingerprint,
			}),
		UnitMergeReviewDuplicate,
	);
	const accepted = await reviewUnitMerge(secondReviewer.authorization, created.id, {
		decision: "approve",
		requestFingerprint: manifest.fingerprint,
	});
	counted(accepted.state === "accepted");
	counted(accepted.approvals === 2);
	assert.ok(accepted.operation);
	const locks = await database
		.select({ unitId: unitMergeGraphLock.unitId })
		.from(unitMergeGraphLock)
		.where(eq(unitMergeGraphLock.operationId, accepted.operation.id));
	counted(locks.length === 2);

	await rejects(
		() =>
			asActor(proposer, async (tx) => {
				const row = await loadCatalogIdentity(tx, source.reference, proposer.account.id, true);
				return addCatalogName(
					tx,
					source.reference,
					proposer.account.id,
					row.revision,
					nameValue("Frozen after accept", "alias"),
				);
			}),
		CatalogReferenceNotFound,
	);

	const firstClaim = await claimUnitMergeOperations(new Date(), 1);
	counted(firstClaim.length === 1);
	const claimed = firstClaim[0];
	assert.ok(claimed);
	counted(claimed.phase === "canonicalize");
	const firstPage = await processClaimedUnitMergePage(claimed);
	counted(firstPage.outcome === "continued");
	const afterCanonicalize = await getUnitMergeRequest(proposer.authorization, created.id);
	counted(afterCanonicalize.canonicalizedAt !== null);
	const archived = await identityRow(source.reference.id);
	counted(archived.status === "archived");
	counted(archived.revision === sourceBefore.revision + 1);
	const [redirect] = await database
		.select()
		.from(unitMergeRedirect)
		.where(eq(unitMergeRedirect.sourceUnitId, source.reference.id));
	assert.ok(redirect);
	counted(redirect.targetUnitId === target.reference.id);
	counted(redirect.sourceWasPublic === true);
	await rejects(
		() =>
			asActor(proposer, async (tx) => {
				const row = await loadCatalogIdentity(tx, source.reference, proposer.account.id, true);
				return addCatalogName(
					tx,
					source.reference,
					proposer.account.id,
					row.revision,
					nameValue("Frozen after canonicalize", "alias"),
				);
			}),
		CatalogAccessDenied,
	);

	await reconcile();
	const completed = await getUnitMergeRequest(proposer.authorization, created.id);
	counted(completed.state === "completed");
	counted(completed.operation?.state === "completed");
	const remainingLocks = await database
		.select({ unitId: unitMergeGraphLock.unitId })
		.from(unitMergeGraphLock)
		.where(eq(unitMergeGraphLock.operationId, accepted.operation.id));
	counted(remainingLocks.length === 0);

	const sourceNamesAfter = await database
		.select({
			id: CatalogNameTables.publishing.name.id,
			value: CatalogNameTables.publishing.name.value,
			revision: CatalogNameTables.publishing.name.revision,
			state: CatalogNameTables.publishing.name.state,
		})
		.from(CatalogNameTables.publishing.name)
		.where(eq(CatalogNameTables.publishing.name.ownerId, source.reference.id));
	counted(
		sourceNamesAfter.some(
			(row) =>
				row.id === sourceNamesBefore[0]?.id &&
				row.value === "Native merge source work" &&
				row.revision === sourceNamesBefore[0]?.revision,
		),
	);
	const targetNames = await database
		.select({
			value: CatalogNameTables.publishing.name.value,
			kind: CatalogNameTables.publishing.name.kind,
			primaryForLanguage: CatalogNameTables.publishing.name.primaryForLanguage,
		})
		.from(CatalogNameTables.publishing.name)
		.where(eq(CatalogNameTables.publishing.name.ownerId, target.reference.id));
	counted(
		targetNames.some(
			(row) => row.value === "Native merge source work" && row.primaryForLanguage === false,
		),
	);
	const sourceIdentifiers = await database
		.select({
			id: CatalogNameTables.publishing.identifier.id,
			value: CatalogNameTables.publishing.identifier.value,
			revision: CatalogNameTables.publishing.identifier.revision,
		})
		.from(CatalogNameTables.publishing.identifier)
		.where(eq(CatalogNameTables.publishing.identifier.ownerId, source.reference.id));
	counted(
		sourceIdentifiers.some(
			(row) => row.id === originalIdentifier.id && row.revision === originalIdentifier.identifierRevision,
		),
	);
	const [semantic] = await database
		.select({
			semanticId: CatalogFactTables.publishing.semanticHead.semanticId,
			version: CatalogFactTables.publishing.semanticHead.version,
		})
		.from(CatalogFactTables.publishing.semanticHead)
		.where(eq(CatalogFactTables.publishing.semanticHead.ownerId, source.reference.id));
	counted(semantic?.semanticId === originalFact.semanticId);
	counted(semantic?.version === originalFact.headVersion);
	const sourceChangesAfter = await database
		.select({
			version: CatalogFactTables.publishing.change.version,
			operation: CatalogFactTables.publishing.change.operation,
		})
		.from(CatalogFactTables.publishing.change)
		.where(eq(CatalogFactTables.publishing.change.ownerId, source.reference.id));
	counted(
		sourceChangesBefore.every((before) =>
			sourceChangesAfter.some(
				(after) => after.version === before.version && after.operation === before.operation,
			),
		),
	);
	counted(sourceChangesAfter.some((row) => row.operation === "identity.merge.archive"));
	const bindingHistory = await database
		.select({
			revision: catalogSourceBindingRevision.revision,
			state: catalogSourceBindingRevision.state,
			publishingId: catalogSourceBindingRevision.publishingId,
		})
		.from(catalogSourceBindingRevision)
		.where(
			and(
				eq(catalogSourceBindingRevision.sourceRecordId, originalBinding.sourceRecordId),
				eq(catalogSourceBindingRevision.mappingKey, originalBinding.mappingKey),
			),
		);
	counted(
		bindingHistory.some(
			(row) =>
				row.revision === 1 &&
				row.state === "active" &&
				row.publishingId === source.reference.id,
		),
	);
	counted(
		bindingHistory.some(
			(row) =>
				row.revision === 2 &&
				row.state === "paused" &&
				row.publishingId === target.reference.id,
		),
	);
	const [claim] = await database
		.select({
			bindingRevision: catalogSourceMappingClaim.bindingRevision,
		})
		.from(catalogSourceMappingClaim)
		.where(
			and(
				eq(catalogSourceMappingClaim.sourceRecordId, originalBinding.sourceRecordId),
				eq(catalogSourceMappingClaim.mappingKey, originalBinding.mappingKey),
			),
		);
	counted(claim?.bindingRevision === 2);

	const items = await listMergeReconciliationItems(proposer.authorization, created.id, {
		limit: 100,
	});
	counted(items.items.some((item) => item.kind === "name" && item.state === "applied"));
	counted(items.items.some((item) => item.kind === "identifier" && item.state === "applied"));
	counted(items.items.some((item) => item.kind === "semantic" && item.decision === "retain_semantic_snapshot"));
	counted(items.items.some((item) => item.kind === "source_binding" && item.decision === "rebind_paused"));
	counted(items.items.some((item) => item.kind === "structure" && item.decision === "retain_native_structure"));

	const receipts = await asActor(proposer, (tx) =>
		listMergedCatalogSources(tx, target.reference, proposer.account.id, { limit: 10 }),
	);
	counted(receipts.items.length === 1);
	counted(receipts.items[0]?.readable === true);
	counted(receipts.items[0]?.source.id === source.reference.id);
	counted(receipts.items[0]?.source.title === "Native merge source work");
	counted(receipts.items[0]?.plan.retainedAccess === "target_readers");
	const publicReceipts = await database.transaction((tx) =>
		withCatalogViewerPolicy(tx, null, () =>
			listMergedCatalogSources(tx, target.reference, null, { limit: 10 }),
		),
	);
	counted(publicReceipts.items[0]?.readable === true);
	const readableSource = await asActor(stranger, (tx) =>
		loadCatalogIdentity(tx, source.reference, stranger.account.id, false),
	);
	counted(readableSource.status === "archived");

	const hiddenSource = await publishingWork(proposer, "Native merge hidden source", {
		visibility: "private",
	});
	const hiddenTarget = await publishingWork(proposer, "Native merge hidden target", {
		visibility: "private",
	});
	const hidden = await propose(proposer, hiddenSource.reference, hiddenTarget.reference, [rule]);
	await reviewUnitMerge(firstReviewer.authorization, hidden.id, {
		decision: "approve",
		requestFingerprint: hidden.manifest.fingerprint,
	});
	await reviewUnitMerge(secondReviewer.authorization, hidden.id, {
		decision: "approve",
		requestFingerprint: hidden.manifest.fingerprint,
	});
	await reconcile();
	const hiddenCompleted = await getUnitMergeRequest(proposer.authorization, hidden.id);
	counted(hiddenCompleted.state === "completed");
	const hiddenReceipts = await asActor(proposer, (tx) =>
		listMergedCatalogSources(tx, hiddenTarget.reference, proposer.account.id, { limit: 10 }),
	);
	counted(hiddenReceipts.items[0]?.readable === true);
	await rejects(
		() =>
			asActor(stranger, (tx) =>
				listMergedCatalogSources(tx, hiddenTarget.reference, stranger.account.id, { limit: 10 }),
			),
		CatalogAccessDenied,
	);
	await rejects(
		() =>
			asActor(stranger, (tx) =>
				loadCatalogIdentity(tx, hiddenTarget.reference, stranger.account.id, false),
			),
		CatalogAccessDenied,
	);

	const pageSource = await publishingWork(proposer, "Native merge paging source");
	const pageTarget = await publishingWork(proposer, "Native merge paging target");
	await asActor(proposer, async (tx) => {
		let revision = (await loadCatalogIdentity(tx, pageSource.reference, proposer.account.id, true))
			.revision;
		for (let index = 0; index < 130; index++) {
			const added = await addCatalogName(
				tx,
				pageSource.reference,
				proposer.account.id,
				revision,
				nameValue(`Native merge page ${index.toString().padStart(3, "0")}`, "alias"),
			);
			revision = added.revision;
		}
	});
	const paging = await propose(proposer, pageSource.reference, pageTarget.reference, [rule]);
	await reviewUnitMerge(firstReviewer.authorization, paging.id, {
		decision: "approve",
		requestFingerprint: paging.manifest.fingerprint,
	});
	await reviewUnitMerge(secondReviewer.authorization, paging.id, {
		decision: "approve",
		requestFingerprint: paging.manifest.fingerprint,
	});
	await reconcile(400);
	const pagingCompleted = await getUnitMergeRequest(proposer.authorization, paging.id);
	counted(pagingCompleted.state === "completed");
	counted((pagingCompleted.operation?.totalItems ?? 0) > 128);
	const firstPageItems = await listMergeReconciliationItems(proposer.authorization, paging.id, {
		limit: 100,
	});
	counted(firstPageItems.items.length === 100);
	counted(typeof firstPageItems.nextCursor === "string");
	const secondPageItems = await listMergeReconciliationItems(proposer.authorization, paging.id, {
		limit: 100,
		cursor: firstPageItems.nextCursor ?? undefined,
	});
	counted(secondPageItems.items.length > 28);
	counted(
		!firstPageItems.items.some((item) =>
			secondPageItems.items.some((other) => other.id === item.id),
		),
	);

	const conflictSource = await publishingWork(proposer, "Native merge conflict source");
	const conflictTarget = await publishingWork(proposer, "Native merge conflict target");
	const conflictBinding = await attachBinding(proposer, conflictSource.reference);
	const conflict = await propose(proposer, conflictSource.reference, conflictTarget.reference, [
		rule,
	]);
	await reviewUnitMerge(firstReviewer.authorization, conflict.id, {
		decision: "approve",
		requestFingerprint: conflict.manifest.fingerprint,
	});
	await reviewUnitMerge(secondReviewer.authorization, conflict.id, {
		decision: "approve",
		requestFingerprint: conflict.manifest.fingerprint,
	});
	await drainUntilBindings(conflict.id);
	const ready = deferred<number>();
	const release = deferred<void>();
	const stale = database.transaction((tx) =>
		runWithParticipationAuthority(proposer.authority, async () => {
			await lockCatalogSourceBinding(tx, {
				sourceRecordId: conflictBinding.sourceRecordId,
				mappingKey: conflictBinding.mappingKey,
			});
			const pid = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
			const backend = pid.rows[0];
			assert.ok(backend);
			ready.resolve(backend.pid);
			await release.promise;
			await reviseCatalogSourceBinding(tx, proposer.account.id, {
				sourceRecordId: conflictBinding.sourceRecordId,
				mappingKey: conflictBinding.mappingKey,
				expectedRevision: 1,
				state: "paused",
				mode: "review",
				reason: "Concurrent native merge fixture pause",
			});
		}),
	);
	const blocker = await ready.promise;
	const worker = (async () => {
		const claimedBindings = await claimUnitMergeOperations(new Date(), 1);
		const bindingPage = claimedBindings[0];
		assert.ok(bindingPage);
		assert.equal(bindingPage.phase, "bindings");
		const running = processClaimedUnitMergePage(bindingPage);
		await waiter(blocker);
		release.resolve();
		return running;
	})();
	await Promise.all([stale, worker]);
	await reconcile();
	const conflicted = await getUnitMergeRequest(proposer.authorization, conflict.id);
	counted(
		conflicted.state === "action_required" ||
			conflicted.operation?.state === "action_required" ||
			conflicted.state === "completed",
	);
	const conflictItems = await listMergeReconciliationItems(proposer.authorization, conflict.id, {
		state: "action_required",
		limit: 100,
	});
	const bindingItem = conflictItems.items.find((item) => item.kind === "source_binding");
	if (bindingItem) {
		counted(bindingItem.errorCode === "binding_changed");
		const listedBinding = bindingItem.currentBinding;
		assert.ok(listedBinding);
		assertions++;
		const targetRow = await identityRow(conflictTarget.reference.id);
		await rejects(
			() =>
				resolveMergeReconciliationItem(proposer.authorization, conflict.id, bindingItem.id, {
					action: "retain_source",
					expectedTargetRevision: targetRow.revision,
					reason: "source_binding resolve requires expectedBindingRevision",
				}),
			ValidationError,
		);
		await rejects(
			() =>
				resolveMergeReconciliationItem(proposer.authorization, conflict.id, bindingItem.id, {
					action: "retain_source",
					expectedTargetRevision: targetRow.revision,
					expectedBindingRevision: bindingItem.sourceBindingRevision ?? listedBinding.revision - 1,
					reason: "Stale sourceBindingRevision must not resolve a drifted binding",
				}),
			CatalogRevisionConflict,
		);
		await resolveMergeReconciliationItem(proposer.authorization, conflict.id, bindingItem.id, {
			action: "retain_source",
			expectedTargetRevision: targetRow.revision,
			expectedBindingRevision: listedBinding.revision,
			reason: "Human retain of the paused source binding after a stale fence",
		});
		const retried = await listMergeReconciliationItems(proposer.authorization, conflict.id, {
			limit: 100,
		});
		counted(
			retried.items.some(
				(item) =>
					item.id === bindingItem.id &&
					(item.state === "retained" || item.state === "applied"),
			),
		);
		await reconcile();
	}

	const reboundSource = await publishingWork(proposer, "Native merge rebound source");
	const reboundTarget = await publishingWork(proposer, "Native merge rebound target");
	const independentBindingTarget = await publishingWork(
		proposer,
		"Native merge independent binding target",
	);
	const reboundBinding = await attachBinding(proposer, reboundSource.reference);
	const reboundMerge = await propose(
		proposer,
		reboundSource.reference,
		reboundTarget.reference,
		[rule],
	);
	await reviewUnitMerge(firstReviewer.authorization, reboundMerge.id, {
		decision: "approve",
		requestFingerprint: reboundMerge.manifest.fingerprint,
	});
	await reviewUnitMerge(secondReviewer.authorization, reboundMerge.id, {
		decision: "approve",
		requestFingerprint: reboundMerge.manifest.fingerprint,
	});
	await drainUntilBindings(reboundMerge.id);
	await asActor(proposer, (tx) =>
		reviseCatalogSourceBinding(tx, proposer.account.id, {
			sourceRecordId: reboundBinding.sourceRecordId,
			mappingKey: reboundBinding.mappingKey,
			expectedRevision: reboundBinding.bindingRevision,
			state: "active",
			mode: "manual",
			reason: "Independent rebind before merge binding page",
			target: independentBindingTarget.reference,
		}),
	);
	await reconcile();
	const reboundStatus = await getUnitMergeRequest(proposer.authorization, reboundMerge.id);
	counted(
		reboundStatus.state === "action_required" ||
			reboundStatus.operation?.state === "action_required",
	);
	const reboundItems = await listMergeReconciliationItems(proposer.authorization, reboundMerge.id, {
		state: "action_required",
		limit: 100,
	});
	const reboundItem = reboundItems.items.find((item) => item.kind === "source_binding");
	assert.ok(reboundItem);
	const reboundCurrent = reboundItem.currentBinding;
	assert.ok(reboundCurrent);
	assertions += 2;
	counted(reboundCurrent.reference.id === independentBindingTarget.reference.id);
	const reboundTargetRow = await identityRow(reboundTarget.reference.id);
	await rejects(
		() =>
			resolveMergeReconciliationItem(proposer.authorization, reboundMerge.id, reboundItem.id, {
				action: "retry",
				expectedTargetRevision: reboundTargetRow.revision,
				expectedBindingRevision: reboundCurrent.revision,
				reason: "Retry must not move a binding that is no longer on source",
			}),
		CatalogRevisionConflict,
	);
	await resolveMergeReconciliationItem(proposer.authorization, reboundMerge.id, reboundItem.id, {
		action: "retain_source",
		expectedTargetRevision: reboundTargetRow.revision,
		expectedBindingRevision: reboundCurrent.revision,
		reason: "Retain independently rebound binding without overwriting it",
	});
	const reboundAfter = await listMergeReconciliationItems(proposer.authorization, reboundMerge.id, {
		limit: 100,
	});
	counted(
		reboundAfter.items.some(
			(item) =>
				item.id === reboundItem.id &&
				(item.state === "retained" || item.state === "applied") &&
				item.currentBinding?.reference.id === independentBindingTarget.reference.id,
		),
	);
	const [reboundClaim] = await database
		.select({
			bindingRevision: catalogSourceMappingClaim.bindingRevision,
			publishingId: catalogSourceBindingRevision.publishingId,
		})
		.from(catalogSourceMappingClaim)
		.innerJoin(
			catalogSourceBindingRevision,
			and(
				eq(catalogSourceBindingRevision.sourceRecordId, catalogSourceMappingClaim.sourceRecordId),
				eq(catalogSourceBindingRevision.mappingKey, catalogSourceMappingClaim.mappingKey),
				eq(catalogSourceBindingRevision.revision, catalogSourceMappingClaim.bindingRevision),
			),
		)
		.where(
			and(
				eq(catalogSourceMappingClaim.sourceRecordId, reboundBinding.sourceRecordId),
				eq(catalogSourceMappingClaim.mappingKey, reboundBinding.mappingKey),
			),
		);
	counted(reboundClaim?.publishingId === independentBindingTarget.reference.id);

	const revokedProposer = await human("Native merge revoked proposer");
	await grant(revokedProposer, "unit.merge");
	const revokedSource = await publishingWork(revokedProposer, "Native merge revoked source");
	const revokedTarget = await publishingWork(revokedProposer, "Native merge revoked target");
	const revokedRequest = await propose(
		revokedProposer,
		revokedSource.reference,
		revokedTarget.reference,
		[rule],
	);
	const [revokedGrant] = await database
		.update(platformCapabilityGrant)
		.set({
			revokedAt: new Date(),
			revokedByAuthUserId: proposer.account.id,
		})
		.where(
			and(
				eq(platformCapabilityGrant.authUserId, revokedProposer.account.id),
				eq(platformCapabilityGrant.capability, "unit.merge"),
				sql`${platformCapabilityGrant.revokedAt} is null`,
			),
		)
		.returning({ id: platformCapabilityGrant.id });
	assert.ok(revokedGrant);
	assertions++;
	await rejects(
		() => getUnitMergeRequest(revokedProposer.authorization, revokedRequest.id),
		PlatformCapabilityRequired,
	);
	await rejects(
		() =>
			preflightUnitMerge(revokedProposer.authorization, {
				sourceUnitId: revokedSource.reference.id,
				targetUnitId: revokedTarget.reference.id,
				plan: DefaultMergePlan,
			}),
		PlatformCapabilityRequired,
	);

	const independent = await getUnitMergeRequest(proposer.authorization, created.id);
	counted(independent.state === "completed");
	counted(independent.id !== paging.id);
	counted(independent.id !== hidden.id);
	console.info(
		JSON.stringify({
			selfReviewerForbidden: true,
			duplicateAuthReviewDenied: true,
			servicePrincipalDenied: true,
			twoHumanApprovalsQueuedAndReconciled: true,
			originalNamesFactsAndSourceEpochsPreserved: true,
			staleRevisionAndFingerprintRejected: true,
			sourceTargetAccessEnforced: true,
			sourceOrdinaryWritesFrozen: true,
			reconciliationPagingOver128: true,
			sourceBindingRebindPausedWithHistory: true,
			staleBindingHumanRetainRetry: Boolean(bindingItem),
			concurrentBindingDriftRejectsStaleRevision: Boolean(bindingItem),
			independentRebindRetainDoesNotOverwrite: true,
			retryMovesBindingOnlyWhileOnSource: true,
			revokedProposerDenied: true,
			currentNativeNonReaderDenied: true,
			mergedSourceReceiptsFollowTargetAudience: true,
			canonicalGuardsNativeOwnerShapeStatusVisibilityRating: true,
			participatingOrControlledEntityBlocked: true,
			assertions,
			fixtureHistoryRetained: true,
		}),
	);
} finally {
	if (accounts.length)
		await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
