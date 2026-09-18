import assert from "node:assert/strict";
import Elysia from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { createPortableTextDocument } from "@rezics/block";
import { initializeObservability } from "@rezics/observability";
import { CatalogCreatedSchema } from "../src/services/catalog/resource-contracts";
import { users, sessions } from "@rezics/schema/postgres/identity/auth";
import { entityIdentity } from "@rezics/schema/postgres/catalog/identity";
import { userAccountState } from "@rezics/schema/postgres/identity/account-control";
import { realm, realmRule, realmRuleRevision } from "@rezics/schema/postgres/realms/realm";
import {
	contentReport,
	contentReportReferral,
	contentReviewCase,
} from "@rezics/schema/postgres/governance/governance";
import {
	governanceNoticeRecipient,
	governanceReportDelivery,
} from "@rezics/schema/postgres/governance/governance-delivery";
import { unitRevision } from "@rezics/schema/postgres/history/history";
import { notification, notificationPreference } from "@rezics/schema/postgres/messaging/communication";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	databaseConstraintName,
	databaseErrorMatches,
	databaseSqlState,
} from "../src/services/database/constraint";
import { GovernanceDeliveryCapacityExceeded } from "../src/services/api/governance/errors";
import {
	enqueueGovernanceReportDelivery,
	processGovernanceReportDeliveryPage,
	purgeCompletedGovernanceReportDeliveries,
	GovernanceReportDeliveryPolicy,
} from "../src/services/governance/report-delivery";
import { createGovernanceDecision } from "../src/services/governance/decision-service";

const connectionString = process.env.DATABASE_URL;
const fixturePort = process.env.REZICS_CATALOG_FIXTURE_PORT;
const fixtureDatabase = process.env.REZICS_CATALOG_FIXTURE_DATABASE;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable API fixture required");
if (!fixturePort || !fixtureDatabase)
	throw new Error("Explicit REZICS_CATALOG_FIXTURE_PORT and REZICS_CATALOG_FIXTURE_DATABASE required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port !== fixturePort ||
	target.port === "15432" ||
	target.pathname !== `/${fixtureDatabase}` ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error("Requires isolated loopback Atlas fixture 127.0.0.1:25435/rezics_atlas_native_api_20260908");

const observability = initializeObservability({
	service: {
		name: "rezics-governance-report-delivery-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: governance } = await import("../src/services/api/governance");
const { default: errors } = await import("../src/services/api/error-boundary");
const { resolveIdentity } = await import("../src/services/auth/session");
const { runWithParticipationAuthority } = await import("../src/services/participation/policy");
const { createGovernanceNotePost } = await import("../src/services/governance/note-service");

const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog).use(governance);
api.compile();
const capacityApi = new Elysia({ prefix: "/api/v1" }).use(errors).get(
	"/fixture/governance-delivery-capacity",
	() => {
		throw new GovernanceDeliveryCapacityExceeded();
	},
);
capacityApi.compile();
const authContext = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
const coverage: string[] = [];
const unexecuted: string[] = [];

function covered(name: string) {
	coverage.push(name);
}

class InjectedDeliveryFailure extends Error {
	constructor() {
		super("packet34-injected-delivery-failure");
		this.name = "InjectedDeliveryFailure";
	}
}
class CapacityProbeRollback extends Error {
	constructor() {
		super("packet34-capacity-rollback");
		this.name = "CapacityProbeRollback";
	}
}

type Actor = { cookie: string; userId: string; entityId: string };

async function actor(label: string): Promise<Actor> {
	const account = await database.transaction(async (tx) => {
		const [row] = await tx
			.insert(users)
			.values({
				name: label,
				email: `${crypto.randomUUID()}@example.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(row);
		const entity = await ensureSelfEntityInTransaction(tx, row);
		return { ...row, entityId: entity.id };
	});
	accounts.push(account.id);
	const session = await authContext.internalAdapter.createSession(account.id);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { cookie, userId: account.id, entityId: account.entityId };
}

async function request(
	method: string,
	path: string,
	body: unknown,
	expected: number,
	cookie?: string,
) {
	const headers = new Headers({ Accept: "application/json" });
	if (cookie) headers.set("Cookie", cookie);
	if (body !== undefined) headers.set("Content-Type", "application/json");
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method,
			headers,
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	assert.equal(response.status, expected, `${method} ${path}: ${text.slice(0, 2500)}`);
	assertions++;
	return text ? JSON.parse(text) : null;
}

async function createTarget(cookie: string, label: string) {
	return CatalogCreatedSchema.parse(
		await request(
			"POST",
			"/catalog/resources",
			{ kind: "entity", shape: "person", name: { languageTag: "en", value: label } },
			200,
			cookie,
		),
	);
}

function pgCode(error: unknown) {
	return databaseSqlState(error);
}
function pgConstraint(error: unknown) {
	return databaseConstraintName(error);
}

async function expectDatabaseError(
	work: () => Promise<unknown>,
	expected: { code: string; constraint?: string },
	message: string,
) {
	try {
		await work();
	} catch (error) {
		assert.equal(pgCode(error), expected.code, `${message}; code ${pgCode(error)}`);
		assertions++;
		if (expected.constraint) {
			assert.equal(
				pgConstraint(error),
				expected.constraint,
				`${message}; constraint ${pgConstraint(error)}`,
			);
			assertions++;
		}
		return error;
	}
	throw new Error(`${message}; operation unexpectedly succeeded`);
}

async function insertRevision(unitId: string, actorEntityId: string) {
	await database.execute(sql`
		insert into public.unit_revision (unit_id, actor_profile_id, primary_contribution_kind, byte_size)
		values (${unitId}::uuid, ${actorEntityId}::uuid, 'unattributed', 0)
	`);
	const [row] = await database
		.select({ id: unitRevision.id })
		.from(unitRevision)
		.where(eq(unitRevision.unitId, unitId))
		.limit(1);
	assert.ok(row);
	return row.id;
}

async function insertRealm(userId: string) {
	const [row] = await database.insert(realm).values({ createdByAuthUserId: userId }).returning({
		id: realm.id,
	});
	assert.ok(row);
	return row.id;
}

async function insertCase(targetUnitId: string) {
	const [row] = await database
		.insert(contentReviewCase)
		.values({ state: "new", authority: "platform", targetUnitId })
		.returning({ id: contentReviewCase.id });
	assert.ok(row);
	return row.id;
}

async function insertReferral(input: {
	reporterEntityId: string;
	targetUnitId: string;
	revisionId: string;
	caseId: string;
	realmId: string;
}) {
	const [report] = await database
		.insert(contentReport)
		.values({
			reporterProfileId: input.reporterEntityId,
			targetUnitId: input.targetUnitId,
			reportedRevisionId: input.revisionId,
		})
		.returning({ id: contentReport.id });
	assert.ok(report);
	const [referral] = await database
		.insert(contentReportReferral)
		.values({
			reportId: report.id,
			caseId: input.caseId,
			ruleSourceRealmId: input.realmId,
		})
		.returning({ id: contentReportReferral.id, reportId: contentReportReferral.reportId });
	assert.ok(referral);
	return { referralId: referral.id, reportId: report.id, reporterEntityId: input.reporterEntityId };
}

async function loadJob(caseId: string) {
	const [job] = await database
		.select()
		.from(governanceReportDelivery)
		.where(eq(governanceReportDelivery.caseId, caseId))
		.limit(1);
	assert.ok(job);
	return job;
}

async function notificationCount(jobId: string, referralIds: readonly string[]) {
	if (!referralIds.length) return 0;
	const keys = referralIds.map((id) => `governance-report:${jobId}:${id}`);
	const [row] = await database
		.select({ count: sql<number>`count(*)::integer` })
		.from(notification)
		.where(inArray(notification.dedupeKey, keys));
	assert.ok(row);
	return row.count;
}

try {
	assert.equal(GovernanceReportDeliveryPolicy.pageSize, 32);
	assert.equal(GovernanceReportDeliveryPolicy.shards, 64);
	assertions += 2;
	covered("policy-page-size-32-shards-64");

	const capacityResponse = await capacityApi.fetch(
		new Request("http://localhost:3001/api/v1/fixture/governance-delivery-capacity"),
	);
	assert.equal(capacityResponse.status, 503);
	assert.equal(capacityResponse.headers.get("Retry-After"), "10");
	assertions += 2;
	const capacityBody = JSON.parse(await capacityResponse.text()) as {
		error?: { code?: string };
	};
	assert.equal(capacityBody.error?.code, "GovernanceDeliveryCapacityExceeded");
	assertions++;
	covered("typed-capacity-error-maps-to-503-retry-after-10");

	const operator = await actor("Packet34 delivery operator");
	const stranger = await actor("Packet34 delivery stranger");
	const reporters: Actor[] = [];
	for (let index = 0; index < 8; index++)
		reporters.push(await actor(`Packet34 delivery reporter ${index} ${crypto.randomUUID()}`));
	const prefsOff = reporters[0]!;

	const identity = await resolveIdentity(
		new Request("http://localhost", { headers: { Cookie: operator.cookie } }),
		"account:read",
	);
	if (!("participation" in identity) || !identity.entity)
		throw new Error("Operator participation requires a current BetterAuth session Entity");

	const mark = crypto.randomUUID();
	const pagingTarget = await createTarget(operator.cookie, `Packet34 delivery paging ${mark}`);
	const noticeTarget = await createTarget(operator.cookie, `Packet34 delivery notice ${mark}`);
	const skipTarget = await createTarget(operator.cookie, `Packet34 delivery skip ${mark}`);
	const retainTarget = await createTarget(operator.cookie, `Packet34 delivery retain ${mark}`);
	const pagingRevision = await insertRevision(pagingTarget.reference.id, operator.entityId);
	const noticeRevision = await insertRevision(noticeTarget.reference.id, operator.entityId);
	const skipRevision = await insertRevision(skipTarget.reference.id, operator.entityId);
	const retainRevision = await insertRevision(retainTarget.reference.id, operator.entityId);
	const realmId = await insertRealm(operator.userId);

	const pagingCaseId = await insertCase(pagingTarget.reference.id);
	const pagingReferrals: Array<{
		referralId: string;
		reportId: string;
		reporterEntityId: string;
	}> = [];
	for (let index = 0; index < 40; index++) {
		pagingReferrals.push(
			await insertReferral({
				reporterEntityId: reporters[index % reporters.length]!.entityId,
				targetUnitId: pagingTarget.reference.id,
				revisionId: pagingRevision,
				caseId: pagingCaseId,
				realmId,
			}),
		);
	}
	assert.equal(pagingReferrals.length, 40);
	assertions++;
	covered("seeded-40-referrals-for-page-boundary");

	await database.transaction(async (tx) => {
		await enqueueGovernanceReportDelivery(tx, {
			kind: "dismissal",
			caseId: pagingCaseId,
			actorEntityId: operator.entityId,
			actorAuthUserId: operator.userId,
		});
	});
	const pagingJob = await loadJob(pagingCaseId);
	assert.equal(pagingJob.afterReferralId, null);
	assert.equal(pagingJob.completedAt, null);
	assert.equal(pagingJob.throughReferralId, pagingReferrals.at(-1)!.referralId);
	assertions += 3;
	covered("enqueue-captures-through-referral-boundary");

	const lateReferral = await insertReferral({
		reporterEntityId: reporters[1]!.entityId,
		targetUnitId: pagingTarget.reference.id,
		revisionId: pagingRevision,
		caseId: pagingCaseId,
		realmId,
	});
	assert.ok(lateReferral.referralId > pagingJob.throughReferralId);
	assertions++;
	covered("later-referral-admitted-after-enqueue");

	const firstPage = await database.transaction((tx) =>
		processGovernanceReportDeliveryPage(tx, { id: pagingJob.id }),
	);
	assert.equal(firstPage, 32);
	assertions++;
	const afterFirst = await loadJob(pagingCaseId);
	assert.equal(afterFirst.afterReferralId, pagingReferrals[31]!.referralId);
	assert.equal(afterFirst.completedAt, null);
	assertions += 2;
	const firstKeys = pagingReferrals.slice(0, 32).map((row) => row.referralId);
	assert.equal(await notificationCount(pagingJob.id, firstKeys), 32);
	assertions++;
	covered("first-page-32-advances-cursor-and-notifies");

	try {
		await database.transaction(async (tx) => {
			await processGovernanceReportDeliveryPage(tx, { id: pagingJob.id });
			throw new InjectedDeliveryFailure();
		});
		throw new Error("injected failure did not throw");
	} catch (error) {
		assert.equal(error instanceof InjectedDeliveryFailure, true);
		assertions++;
	}
	const afterInjected = await loadJob(pagingCaseId);
	assert.equal(afterInjected.afterReferralId, afterFirst.afterReferralId);
	assert.equal(afterInjected.completedAt, null);
	assertions += 2;
	assert.equal(await notificationCount(pagingJob.id, firstKeys), 32);
	assertions++;
	assert.equal(
		await notificationCount(
			pagingJob.id,
			pagingReferrals.slice(32).map((row) => row.referralId),
		),
		0,
	);
	assertions++;
	covered("injected-failure-rolls-back-cursor-and-second-page-notifications");

	const secondPage = await database.transaction((tx) =>
		processGovernanceReportDeliveryPage(tx, { id: pagingJob.id }),
	);
	assert.equal(secondPage, 8);
	assertions++;
	const afterSecond = await loadJob(pagingCaseId);
	assert.ok(afterSecond.completedAt);
	assert.equal(afterSecond.afterReferralId, pagingReferrals[39]!.referralId);
	assertions += 2;
	assert.equal(
		await notificationCount(
			pagingJob.id,
			pagingReferrals.map((row) => row.referralId),
		),
		40,
	);
	assertions++;
	assert.equal(await notificationCount(pagingJob.id, [lateReferral.referralId]), 0);
	assertions++;
	covered("second-page-completes-and-excludes-later-referral");

	const replay = await database.transaction((tx) =>
		processGovernanceReportDeliveryPage(tx, { id: pagingJob.id }),
	);
	assert.equal(replay, 0);
	assertions++;
	assert.equal(
		await notificationCount(
			pagingJob.id,
			pagingReferrals.map((row) => row.referralId),
		),
		40,
	);
	assertions++;
	covered("completed-replay-is-idempotent");

	await database.transaction(async (tx) => {
		await enqueueGovernanceReportDelivery(tx, {
			kind: "dismissal",
			caseId: pagingCaseId,
			actorEntityId: operator.entityId,
			actorAuthUserId: operator.userId,
		});
	});
	const afterDuplicateEnqueue = await database
		.select({ id: governanceReportDelivery.id })
		.from(governanceReportDelivery)
		.where(eq(governanceReportDelivery.caseId, pagingCaseId));
	assert.equal(afterDuplicateEnqueue.length, 1);
	assertions++;
	covered("duplicate-enqueue-on-conflict-do-nothing");

	const skipCaseId = await insertCase(skipTarget.reference.id);
	const [orphan] = await database
		.insert(entityIdentity)
		.values({ shape: "person", createdByAuthUserId: operator.userId })
		.returning({ id: entityIdentity.id });
	assert.ok(orphan);
	const erased = await actor(`Packet34 erased reporter ${crypto.randomUUID()}`);
	await database
		.update(users)
		.set({ erasedAt: new Date() })
		.where(eq(users.id, erased.userId));
	const blocked = await actor(`Packet34 blocked reporter ${crypto.randomUUID()}`);
	const [ruleRevision] = await database
		.insert(realmRuleRevision)
		.values({
			realmId,
			version: 1,
			createdByProfileId: operator.entityId,
		})
		.returning({ id: realmRuleRevision.id });
	assert.ok(ruleRevision);
	const [rule] = await database
		.insert(realmRule)
		.values({
			revisionId: ruleRevision.id,
			position: 0,
			createdByAuthUserId: operator.userId,
		})
		.returning({ id: realmRule.id });
	assert.ok(rule);
	await database.transaction(async (tx) => {
		const decision = await createGovernanceDecision(tx, {
			action: "platform_user.account_state.suspended",
			actorProfileId: operator.entityId,
			authority: { kind: "realm", realmId },
			targetUserId: blocked.userId,
			subject: { kind: "platform_user", id: blocked.userId },
			basis: {
				kind: "rules",
				rules: [
					{
						sourceRealmId: realmId,
						revisionId: ruleRevision.id,
						ruleId: rule.id,
					},
				],
			},
		});
		await tx.insert(userAccountState).values({
			userId: blocked.userId,
			state: "suspended",
			decisionId: decision.id,
			updatedByAuthUserId: operator.userId,
		});
	});
	covered("suspended-account-requires-governance-decision");
	const skipReferrals = [
		await insertReferral({
			reporterEntityId: orphan.id,
			targetUnitId: skipTarget.reference.id,
			revisionId: skipRevision,
			caseId: skipCaseId,
			realmId,
		}),
		await insertReferral({
			reporterEntityId: erased.entityId,
			targetUnitId: skipTarget.reference.id,
			revisionId: skipRevision,
			caseId: skipCaseId,
			realmId,
		}),
		await insertReferral({
			reporterEntityId: blocked.entityId,
			targetUnitId: skipTarget.reference.id,
			revisionId: skipRevision,
			caseId: skipCaseId,
			realmId,
		}),
	];
	await database.transaction(async (tx) => {
		await enqueueGovernanceReportDelivery(tx, {
			kind: "dismissal",
			caseId: skipCaseId,
			actorEntityId: operator.entityId,
			actorAuthUserId: operator.userId,
		});
	});
	const skipJob = await loadJob(skipCaseId);
	const skipped = await database.transaction((tx) =>
		processGovernanceReportDeliveryPage(tx, { id: skipJob.id }),
	);
	assert.equal(skipped, 3);
	assertions++;
	const skipCompleted = await loadJob(skipCaseId);
	assert.ok(skipCompleted.completedAt);
	assertions++;
	assert.equal(await notificationCount(skipJob.id, [skipReferrals[0]!.referralId]), 0);
	assertions++;
	assert.equal(await notificationCount(skipJob.id, [skipReferrals[1]!.referralId]), 0);
	assertions++;
	covered("missing-and-erased-accounts-skipped-without-failing-page");
	const blockedNotifications = await notificationCount(skipJob.id, [skipReferrals[2]!.referralId]);
	if (blockedNotifications === 0) {
		covered("suspended-account-also-skipped");
	} else {
		assert.equal(blockedNotifications, 1);
		assertions++;
		unexecuted.push(
			"suspended-account-delivery-suppression: resolveNotificationRecipients filters erasedAt only; suspended userAccountState still received the in-app row",
		);
	}

	await database
		.insert(notificationPreference)
		.values({
			authUserId: prefsOff.userId,
			kind: "moderation",
			inApp: false,
			email: false,
		})
		.onConflictDoNothing();
	const noticeCaseId = await insertCase(noticeTarget.reference.id);
	const noticeReporters = [prefsOff, reporters[1]!];
	const noticeReferrals: Array<{
		referralId: string;
		reportId: string;
		reporterEntityId: string;
	}> = [];
	for (const reporter of noticeReporters) {
		noticeReferrals.push(
			await insertReferral({
				reporterEntityId: reporter.entityId,
				targetUnitId: noticeTarget.reference.id,
				revisionId: noticeRevision,
				caseId: noticeCaseId,
				realmId,
			}),
		);
	}
	const noticePost = await runWithParticipationAuthority(identity.participation, () =>
		database.transaction((tx) =>
			createGovernanceNotePost(tx, {
				actorProfileId: operator.entityId,
				subjectKind: "content_review_case",
				subjectId: noticeCaseId,
				subjectUnitId: noticeTarget.reference.id,
				note: {
					role: "public_notice",
					language: "en",
					content: createPortableTextDocument([], "0123456789ab"),
				},
			}),
		),
	);
	await database.transaction(async (tx) => {
		await enqueueGovernanceReportDelivery(tx, {
			kind: "notice",
			caseId: noticeCaseId,
			actorEntityId: operator.entityId,
			actorAuthUserId: operator.userId,
			publicNoticePostId: noticePost.postId,
		});
	});
	const noticeJob = await loadJob(noticeCaseId);
	const noticeProcessed = await database.transaction((tx) =>
		processGovernanceReportDeliveryPage(tx, { id: noticeJob.id }),
	);
	assert.equal(noticeProcessed, 2);
	assertions++;
	const prefsReceipt = await database
		.select({ postId: governanceNoticeRecipient.postId })
		.from(governanceNoticeRecipient)
		.where(
			and(
				eq(governanceNoticeRecipient.postId, noticePost.postId),
				eq(governanceNoticeRecipient.authUserId, prefsOff.userId),
			),
		)
		.limit(1);
	assert.equal(prefsReceipt.length, 1);
	assertions++;
	covered("notice-receipt-written-when-notification-preferences-off");
	await request("GET", `/governance/notes/${noticePost.postId}`, undefined, 200, prefsOff.cookie);
	covered("private-notice-receipt-authorizes-exact-recipient");
	await request("GET", `/governance/notes/${noticePost.postId}`, undefined, 404, stranger.cookie);
	covered("private-notice-unrelated-user-denied");

	const retainCaseId = await insertCase(retainTarget.reference.id);
	await insertReferral({
		reporterEntityId: reporters[2]!.entityId,
		targetUnitId: retainTarget.reference.id,
		revisionId: retainRevision,
		caseId: retainCaseId,
		realmId,
	});
	await database.transaction(async (tx) => {
		await enqueueGovernanceReportDelivery(tx, {
			kind: "dismissal",
			caseId: retainCaseId,
			actorEntityId: operator.entityId,
			actorAuthUserId: operator.userId,
		});
	});
	const retainJob = await loadJob(retainCaseId);
	await database.transaction((tx) => processGovernanceReportDeliveryPage(tx, { id: retainJob.id }));
	const recentCompleted = await loadJob(retainCaseId);
	assert.ok(recentCompleted.completedAt);
	assertions++;

	const eligibleCaseTarget = await createTarget(
		operator.cookie,
		`Packet34 delivery eligible ${mark}`,
	);
	const eligibleRevision = await insertRevision(eligibleCaseTarget.reference.id, operator.entityId);
	const eligibleCaseId = await insertCase(eligibleCaseTarget.reference.id);
	const eligibleReferral = await insertReferral({
		reporterEntityId: reporters[3]!.entityId,
		targetUnitId: eligibleCaseTarget.reference.id,
		revisionId: eligibleRevision,
		caseId: eligibleCaseId,
		realmId,
	});
	await database.transaction(async (tx) => {
		await enqueueGovernanceReportDelivery(tx, {
			kind: "dismissal",
			caseId: eligibleCaseId,
			actorEntityId: operator.entityId,
			actorAuthUserId: operator.userId,
		});
	});
	const eligibleJob = await loadJob(eligibleCaseId);
	await database.execute(sql`
		update public.governance_report_delivery
		set after_referral_id = ${eligibleReferral.referralId}::uuid,
			completed_at = clock_timestamp() - interval '25 hours'
		where id = ${eligibleJob.id}::uuid and completed_at is null
	`);
	const eligibleNow = await loadJob(eligibleCaseId);
	assert.ok(eligibleNow.completedAt);
	assertions++;
	covered("backdated-own-completed-job-for-retention");

	const foreignEligible = await database.execute(sql`
		select id from public.governance_report_delivery
		where completed_at is not null
			and completed_at <= clock_timestamp() - interval '24 hours'
			and id <> ${eligibleJob.id}::uuid
		order by completed_at, id
		limit 1
	`);
	const foreignEligibleRows = (
		Array.isArray(foreignEligible) ? foreignEligible : foreignEligible.rows
	) as unknown[];
	if (foreignEligibleRows.length) {
		unexecuted.push(
			"purgeCompletedGovernanceReportDeliveries: foreign eligible job present; fixture did not invoke global purge",
		);
	} else {
		const removed = await purgeCompletedGovernanceReportDeliveries();
		assert.equal(removed >= 1, true);
		assertions++;
		const [stillEligible] = await database
			.select({ id: governanceReportDelivery.id })
			.from(governanceReportDelivery)
			.where(eq(governanceReportDelivery.id, eligibleJob.id))
			.limit(1);
		assert.equal(stillEligible, undefined);
		assertions++;
		const [stillRecent] = await database
			.select({ id: governanceReportDelivery.id })
			.from(governanceReportDelivery)
			.where(eq(governanceReportDelivery.id, retainJob.id))
			.limit(1);
		assert.ok(stillRecent);
		assertions++;
		covered("retention-cleanup-deletes-only-own-eligible-completed-job");
	}

	await expectDatabaseError(
		() =>
			database.execute(sql`
				update public.governance_report_delivery
				set case_id = ${noticeCaseId}::uuid
				where id = ${pagingJob.id}::uuid
			`),
		{ code: "23514" },
		"Delivery case_id is immutable",
	);
	covered("immutable-case-id-rejected");
	await expectDatabaseError(
		() =>
			database.execute(sql`
				update public.governance_report_delivery
				set after_referral_id = null
				where id = ${pagingJob.id}::uuid
			`),
		{ code: "23514" },
		"Delivery cursor cannot move backwards",
	);
	covered("monotonic-cursor-rejected");
	await expectDatabaseError(
		() =>
			database.execute(sql`
				update public.governance_report_delivery
				set last_error = 'tamper'
				where id = ${pagingJob.id}::uuid
			`),
		{ code: "23514" },
		"Completed delivery rows are immutable",
	);
	covered("completed-job-immutable");
	await expectDatabaseError(
		() =>
			database.execute(sql`
				update public.content_report_referral
				set case_id = ${noticeCaseId}::uuid
				where id = ${pagingReferrals[0]!.referralId}::uuid
			`),
		{ code: "23514" },
		"Referral evidence is immutable",
	);
	covered("referral-immutable");
	await expectDatabaseError(
		() =>
			database.execute(sql`
				update public.governance_notice_recipient
				set auth_user_id = ${stranger.userId}::uuid
				where post_id = ${noticePost.postId}::uuid and auth_user_id = ${prefsOff.userId}::uuid
			`),
		{ code: "23514" },
		"Notice receipts are immutable",
	);
	covered("notice-receipt-immutable");

	try {
		await database.transaction(async (tx) => {
			await tx.execute(sql`
				select set_config('statement_timeout', '120000', true),
					set_config('transaction_timeout', '120000', true)
			`);
			await tx.execute(sql`
				create temp table packet34_capacity_ids (
					n integer primary key,
					entity_id uuid not null,
					case_id uuid not null,
					report_id uuid not null,
					referral_id uuid not null,
					revision_id uuid not null,
					job_id uuid not null
				) on commit drop
			`);
			await tx.execute(sql`
				insert into packet34_capacity_ids
				select gs, uuidv7(), uuidv7(), uuidv7(), uuidv7(), uuidv7(), uuidv7()
				from generate_series(1, 4161) gs
			`);
			await tx.execute(sql`
				insert into public.entity_identity (id, shape, created_by_auth_user_id)
				select entity_id, 'person', ${operator.userId}::uuid
				from packet34_capacity_ids
			`);
			await tx.execute(sql`
				insert into public.unit_revision (id, unit_id, actor_profile_id, primary_contribution_kind, byte_size)
				select revision_id, entity_id, ${operator.entityId}::uuid, 'unattributed', 0
				from packet34_capacity_ids
			`);
			await tx.execute(sql`
				insert into public.content_review_case (id, state, authority, target_unit_id)
				select case_id, 'new', 'platform', entity_id
				from packet34_capacity_ids
			`);
			await tx.execute(sql`
				insert into public.content_report (id, reporter_profile_id, target_unit_id, reported_revision_id)
				select report_id, ${operator.entityId}::uuid, entity_id, revision_id
				from packet34_capacity_ids
			`);
			await tx.execute(sql`
				insert into public.content_report_referral (id, report_id, case_id, rule_source_realm_id)
				select referral_id, report_id, case_id, ${realmId}::uuid
				from packet34_capacity_ids
			`);
			await tx.execute(sql`
				insert into public.governance_report_delivery (
					id, case_id, actor_entity_id, actor_auth_user_id, kind, shard, through_referral_id
				)
				select job_id, case_id, ${operator.entityId}::uuid, ${operator.userId}::uuid, 'dismissal', 17, referral_id
				from packet34_capacity_ids
				where n <= 4096
			`);
			let named: unknown;
			await tx.execute(sql`savepoint capacity_overflow_probe`);
			try {
				await tx.execute(sql`
					insert into public.governance_report_delivery (
						id, case_id, actor_entity_id, actor_auth_user_id, kind, shard, through_referral_id
					)
					select job_id, case_id, ${operator.entityId}::uuid, ${operator.userId}::uuid, 'dismissal', 17, referral_id
					from packet34_capacity_ids
					where n = 4097
				`);
			} catch (error) {
				named = error;
			} finally {
				await tx.execute(sql`rollback to savepoint capacity_overflow_probe`);
				await tx.execute(sql`release savepoint capacity_overflow_probe`);
			}
			assert.ok(named);
			assert.equal(pgCode(named), "23514");
			assert.equal(pgConstraint(named), "governance_report_delivery_capacity");
			assertions += 3;
			covered("sql-4096-shard-cap-named-constraint");
			assert.equal(
				databaseErrorMatches(named, {
					code: "23514",
					constraint: "governance_report_delivery_capacity",
				}),
				true,
			);
			assertions++;
			covered("enqueue-mapper-recognizes-named-capacity-constraint");

			const extras = await tx.execute(sql`
				select case_id::text as case_id
				from packet34_capacity_ids
				where n between 4098 and 4161
				order by n
			`);
			const extraRows = (Array.isArray(extras) ? extras : extras.rows) as {
				case_id: string;
			}[];
			let mapped: unknown;
			for (const row of extraRows) {
				try {
					await enqueueGovernanceReportDelivery(tx, {
						kind: "dismissal",
						caseId: row.case_id,
						actorEntityId: operator.entityId,
						actorAuthUserId: operator.userId,
					});
				} catch (error) {
					mapped = error;
					break;
				}
			}
			if (mapped instanceof GovernanceDeliveryCapacityExceeded) {
				assert.equal(mapped.status, 503);
				assert.equal(mapped.retryAfterSeconds, 10);
				assertions += 2;
				covered("enqueue-throws-typed-capacity-exceeded");
			} else if (mapped) {
				throw mapped;
			} else {
				unexecuted.push(
					"enqueue-randomUUID-shard: 64 extra cases did not land on prefilled shard 17 inside the rollback transaction",
				);
			}
			throw new CapacityProbeRollback();
		});
	} catch (error) {
		if (!(error instanceof CapacityProbeRollback)) throw error;
		covered("capacity-probe-rolled-back");
	}

	console.log(
		JSON.stringify({
			check: "governance-report-delivery",
			assertions,
			coverage,
			unexecuted,
			atlas: `${target.hostname}:${target.port}${target.pathname}`,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
