import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Value } from "typebox/value";
import type { StaticDecode } from "typebox";
import { serializeSignedCookie } from "better-call";
import { defaultKeyHasher } from "@better-auth/api-key";
import { initializeObservability } from "@rezics/observability";
import {
	database,
	withDatabaseTransactionContext,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	sessions,
	apikeys,
	realm,
	realmRuleRevision,
	realmRule,
	accountEnforcement,
	accountEnforcementAction,
} from "../src/services/database/schema";
import { authEntity } from "@rezics/schema/postgres/access/participation";
import { accountPreference } from "@rezics/schema/postgres/identity/account-preference";
import { entityIdentity } from "@rezics/schema/postgres/catalog/identity";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { PreferencesResponse } from "../src/services/api/schema/response";
import { ReplacePreferencesBody } from "../src/services/account/preference-contracts";
import {
	readOwnPreferences,
	updateOwnDisplayPreferences,
} from "../src/services/account/preferences";
import { joinRealm } from "../src/services/realms/membership";
import { readRealmEnrollment } from "../src/services/realms/roster";
import { createAccountIdentity } from "../src/services/authorization/create-account-identity";
import { createGovernanceDecision } from "../src/services/governance/decision-service";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import { AccountClosed } from "../src/services/auth/errors";
import {
	firstPartyAuthorityMetadata,
	captureApiKeyCredentialProof,
} from "../src/services/auth/credential-authority";
import { AccessDenied } from "../src/services/authorization/http-errors";
import { eraseOwnAccount } from "../src/services/participation/erasure";
import {
	assertNativeEnrollmentFixture,
	fixturePrincipalContext,
} from "./native-enrollment-fixture";
import { toApiKeyPermissions } from "@rezics/schema/contracts/native/api-permissions";

assertNativeEnrollmentFixture();
const observability = initializeObservability({
	service: { name: "rezics-native-account-preferences", version: "1.0.0", environment: "tooling" },
});
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const authContext = await auth.$context;
let assertions = 0,
	httpChecks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	assertions++;
}
async function actor(verified = false) {
	const [account] = await database
		.insert(users)
		.values({
			name: "Private preference owner",
			email: `${randomUUID()}@preferences.invalid`,
			emailVerified: verified,
			registrationContentLanguage: "ja",
		})
		.returning();
	assert.ok(account);
	const session = await authContext.internalAdapter.createSession(account.id),
		context = fixturePrincipalContext(session);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { account, session, context, cookie };
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function request(
	method: string,
	path: string,
	status: number,
	person: Actor | undefined,
	body?: unknown,
	headers: Record<string, string> = {},
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method,
			headers: {
				...(person
					? {
							Cookie: person.cookie,
							...(person.context.selection.mode === "direct"
								? {}
								: { "X-Rezics-Authority": JSON.stringify(person.context.selection) }),
						}
					: {}),
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
				...headers,
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, status, `${method} ${path}: ${text.slice(0, 1500)}`);
	httpChecks++;
	if (status === 200)
		check(
			response.headers.get("Cache-Control"),
			"private, no-store",
			"private settings responses cannot be shared-cache entries",
		);
	return text ? JSON.parse(text) : null;
}
const endpoint = "/account/me/preferences";
function replacement(value: StaticDecode<typeof PreferencesResponse>): ReplacePreferencesBody {
	const { scoreVisibility: _score, progressVisibility: _progress, ...body } = value;
	return Value.Decode(ReplacePreferencesBody, body);
}
const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		max: 3,
		statement_timeout: 15000,
	}),
	peer = drizzle({ client: pool });
async function race(
	writer: (tx: DatabaseTransaction) => Promise<unknown>,
	reader: (tx: DatabaseTransaction) => Promise<unknown>,
	observe: (value: Promise<unknown>) => Promise<unknown>,
) {
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const writing = peer.transaction(async (tx) => {
		await writer(tx);
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void writing.catch(ready.reject);
	const blocker = await ready.promise;
	const reading = peer.transaction(async (tx) => {
		started.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return reader(tx);
	});
	void reading.catch(started.reject);
	const observed = observe(reading);
	void observed.catch(() => {});
	try {
		const pid = await started.promise;
		let blocked = false;
		for (let i = 0; i < 500; i++) {
			if (
				(
					await pool.query<{ blocked: boolean }>(
						"select $2::integer=any(pg_blocking_pids($1)) as blocked",
						[pid, blocker],
					)
				).rows[0]?.blocked
			) {
				blocked = true;
				break;
			}
			await setTimeout(10);
		}
		check(blocked, true, "the waiting preference operation has the exact expected account fence");
	} finally {
		release.resolve();
		await writing;
		await observed;
	}
}
try {
	const owner = await actor(),
		other = await actor();
	await request("GET", endpoint, 401, undefined);
	await request("GET", endpoint, 400, owner, undefined, { "X-Rezics-Authority": "invalid" });
	const initial = Value.Decode(
		PreferencesResponse,
		await request("GET", endpoint, 200, owner, undefined, {
			Cookie: `${owner.cookie}; NEXT_LOCALE=zh-Hant`,
		}),
	);
	check(
		[initial.interfaceLocale, initial.preferredLanguages],
		["zh-Hant", ["ja"]],
		"UI locale and registration content language remain independent",
	);
	const later = Value.Decode(
		PreferencesResponse,
		await request("GET", endpoint, 200, owner, undefined, { "Accept-Language": "de" }),
	);
	check(later, initial, "later request headers do not reset saved preferences");
	const display = Value.Decode(
		PreferencesResponse,
		await request("PATCH", endpoint, 200, owner, {
			interfaceLocale: "de",
			customThemesEnabled: false,
		}),
	);
	check(
		[display.interfaceLocale, display.customThemesEnabled, display.preferredLanguages],
		["de", false, ["ja"]],
		"display patch preserves unnamed fields without verified email",
	);
	check(
		await request("PATCH", "/account/me/privacy", 200, owner, { scoreVisibility: "private" }),
		{ scoreVisibility: "private", progressVisibility: initial.progressVisibility },
		"privacy patch is private and preserves its other field",
	);
	await request(
		"PATCH",
		"/account/me/privacy",
		401,
		owner,
		{ scoreVisibility: "public" },
		{ Authorization: "Bearer rz_api_invalid_fixture_key" },
	);
	await request("PATCH", endpoint, 422, owner, {
		interfaceLocale: "en",
		authUserId: other.account.id,
	});
	await request("PATCH", endpoint, 422, owner, {});
	const beforeReplace = Value.Decode(
		PreferencesResponse,
		await request("GET", endpoint, 200, owner),
	);
	await request("PUT", endpoint, 403, owner, replacement(beforeReplace));
	await database.update(users).set({ emailVerified: true }).where(eq(users.id, owner.account.id));
	const replaced = Value.Decode(
		PreferencesResponse,
		await request("PUT", endpoint, 200, owner, {
			...replacement(beforeReplace),
			alwaysShowSpoilers: true,
		}),
	);
	check(
		replaced.alwaysShowSpoilers,
		true,
		"verified complete replacement succeeds with the unchanged default hint",
	);
	check(
		(
			await database
				.select()
				.from(accountPreference)
				.where(eq(accountPreference.authUserId, owner.account.id))
		)[0]?.defaultScoreRealmId,
		null,
		"echoing the implicit default does not require or manufacture a Realm binding",
	);
	const [publicRealm] = await database
		.insert(realm)
		.values({ status: "published", publishedAt: new Date(), visibility: "public" })
		.returning();
	assert.ok(publicRealm);
	const chosen = Value.Decode(
		PreferencesResponse,
		await request("PUT", endpoint, 200, owner, {
			...replacement(replaced),
			defaultScoreRealmId: publicRealm.id,
		}),
	);
	check(
		chosen.defaultScoreRealmId,
		publicRealm.id,
		"a readable default hint does not require public Self",
	);
	check(
		(
			await database.execute<{ n: number }>(
				sql`select count(*)::integer as n from public.access_membership m join public.access_subject s on s.id=m.subject_id where s.auth_user_id=${owner.account.id}::uuid`,
			)
		).rows[0]?.n,
		0,
		"saving a Realm preference grants no admission",
	);
	const [privateRealm] = await database
		.insert(realm)
		.values({ status: "published", publishedAt: new Date(), visibility: "private" })
		.returning();
	assert.ok(privateRealm);
	for (const target of [privateRealm.id, randomUUID()])
		await request("PUT", endpoint, 404, owner, {
			...replacement(chosen),
			defaultScoreRealmId: target,
		});
	await database.update(realm).set({ deletedAt: new Date() }).where(eq(realm.id, publicRealm.id));
	const retained = Value.Decode(
		PreferencesResponse,
		await request("PUT", endpoint, 200, owner, {
			...replacement(chosen),
			customThemesEnabled: true,
		}),
	);
	check(
		retained.defaultScoreRealmId,
		publicRealm.id,
		"editing another preference preserves an unchanged withdrawn default without granting its use",
	);
	check(
		(await database.select().from(authEntity).where(eq(authEntity.authUserId, owner.account.id)))
			.length,
		0,
		"private preference operations never bind a Self",
	);
	check(
		(
			await database
				.select()
				.from(entityIdentity)
				.where(eq(entityIdentity.createdByAuthUserId, owner.account.id))
		).length,
		0,
		"private preference operations create no public Entity",
	);
	check(
		(await request("GET", endpoint, 200, other, undefined, { "Accept-Language": "en" }))
			.interfaceLocale,
		"en",
		"another private account retains independent settings",
	);

	const identity = await createAccountIdentity(owner.context, {
		operationId: randomUUID(),
		names: [{ language: "en", value: "Explicit represented identity" }],
		main: { expectedVersion: 0 },
	});
	const represented = {
		...owner,
		context: new PrincipalRequestContext(
			owner.account.id,
			{
				mode: "represented",
				entityId: identity.entityId,
				representations: [identity.representation],
			},
			owner.context.credentialProof(),
		),
	};
	for (const [method, path, body] of [
		["GET", endpoint, undefined],
		["PATCH", endpoint, { interfaceLocale: "fr" }],
		["PATCH", "/account/me/privacy", { scoreVisibility: "public" }],
		["PUT", endpoint, replacement(retained)],
	] as const)
		await request(method, path, 403, represented, body);
	check(
		(await request("GET", endpoint, 200, owner)).interfaceLocale,
		"de",
		"represented requests cannot change private preferences",
	);

	const key = `rz_api_${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
	const [token] = await database
		.insert(apikeys)
		.values({
			configId: "default",
			createdAt: new Date(),
			updatedAt: new Date(),
			name: "Preference fixture key",
			referenceId: owner.account.id,
			key: await defaultKeyHasher(key),
			enabled: true,
			permissions: JSON.stringify(toApiKeyPermissions(["account:read", "account:update"])),
			metadata: JSON.stringify(firstPartyAuthorityMetadata({ mode: "operator" })),
			expiresAt: new Date(Date.now() + 3600000),
			rateLimitEnabled: false,
		})
		.returning();
	assert.ok(token);
	await request(
		"PATCH",
		endpoint,
		200,
		undefined,
		{ interfaceLocale: "fr" },
		{ Authorization: `Bearer ${key}` },
	);
	const keyPrefs = Value.Decode(
		PreferencesResponse,
		await request("GET", endpoint, 200, undefined, undefined, { Authorization: `Bearer ${key}` }),
	);
	const [keyRealm] = await database
		.insert(realm)
		.values({ status: "published", publishedAt: new Date(), visibility: "public" })
		.returning();
	assert.ok(keyRealm);
	await request(
		"PUT",
		endpoint,
		200,
		undefined,
		{ ...replacement(keyPrefs), defaultScoreRealmId: keyRealm.id },
		{ Authorization: `Bearer ${key}` },
	);
	await database.transaction(async (tx) => {
		const current = await readRealmEnrollment(tx, owner.context, keyRealm.id);
		await joinRealm(tx, owner.context, keyRealm.id, {
			operationId: randomUUID(),
			expectedControlRevision: current.controlRevision,
			expectedRevision: current.receipt?.revision ?? 0,
			expectedMembershipVersion: current.receipt?.version ?? 0,
			expectedEnforcementRevision: current.receipt?.enforcementRevision ?? 0,
			consent: true,
			ruleRevisionId: null,
		});
	});
	await database.update(realm).set({ visibility: "private" }).where(eq(realm.id, keyRealm.id));
	// First move the saved hint away, so the next request must validate private disclosure.
	await request(
		"PUT",
		endpoint,
		200,
		undefined,
		{ ...replacement(keyPrefs), defaultScoreRealmId: OfficialRealmUnitIds.score },
		{ Authorization: `Bearer ${key}` },
	);
	const privateHint = await request(
		"PUT",
		endpoint,
		200,
		undefined,
		{ ...replacement(keyPrefs), defaultScoreRealmId: keyRealm.id },
		{ Authorization: `Bearer ${key}` },
	);
	check(
		privateHint.defaultScoreRealmId,
		keyRealm.id,
		"account:update is the API entry scope; private selection still requires native disclosure",
	);
	await request(
		"PUT",
		endpoint,
		404,
		undefined,
		{ ...replacement(keyPrefs), defaultScoreRealmId: privateRealm.id },
		{ Authorization: `Bearer ${key}` },
	);
	const proof = await captureApiKeyCredentialProof(token.id, owner.account.id, key);
	await assert.rejects(() => updateOwnPrivacyPreferencesForKey(), AccessDenied);
	assertions++;
	async function updateOwnPrivacyPreferencesForKey() {
		const { updateOwnPrivacyPreferences } = await import("../src/services/account/preferences");
		return updateOwnPrivacyPreferences(
			new PrincipalRequestContext(owner.account.id, { mode: "direct" }, proof),
			{ scoreVisibility: "private" },
		);
	}

	// Retain actual write-restriction semantics without conflating harmless personal controls with contribution.
	const enforcer = await actor(true),
		enforcerIdentity = await createAccountIdentity(enforcer.context, {
			operationId: randomUUID(),
			names: [{ language: "en", value: "Preference fixture enforcer" }],
			main: { expectedVersion: 0 },
		});
	await database.transaction(async (tx) => {
		await tx.insert(realm).values({ id: OfficialRealmUnitIds.rule }).onConflictDoNothing();
		let [revision] = await tx
			.select()
			.from(realmRuleRevision)
			.where(eq(realmRuleRevision.realmId, OfficialRealmUnitIds.rule))
			.orderBy(sql`${realmRuleRevision.version} desc`)
			.limit(1);
		if (!revision)
			[revision] = await tx
				.insert(realmRuleRevision)
				.values({
					realmId: OfficialRealmUnitIds.rule,
					version: 1,
					createdByProfileId: enforcerIdentity.entityId,
					publishedAt: new Date(),
				})
				.returning();
		assert.ok(revision);
		let [rule] = await tx
			.select()
			.from(realmRule)
			.where(eq(realmRule.revisionId, revision.id))
			.limit(1);
		if (!rule)
			[rule] = await tx
				.insert(realmRule)
				.values({ revisionId: revision.id, position: 0 })
				.returning();
		assert.ok(rule);
		const decision = await createGovernanceDecision(tx, {
			action: "account.enforcement.create",
			actorProfileId: enforcerIdentity.entityId,
			authority: { kind: "platform" },
			targetUserId: owner.account.id,
			subject: { kind: "auth", id: owner.account.id },
			basis: {
				kind: "rules",
				rules: [
					{ sourceRealmId: OfficialRealmUnitIds.rule, revisionId: revision.id, ruleId: rule.id },
				],
			},
		});
		const [action] = await tx
			.insert(accountEnforcementAction)
			.values({
				decisionId: decision.id,
				actorAuthUserId: enforcer.account.id,
				targetAuthUserId: owner.account.id,
				kind: "issue",
				enforcementKind: "ban",
			})
			.returning();
		assert.ok(action);
		await tx
			.insert(accountEnforcement)
			.values({ authUserId: owner.account.id, kind: "ban", decisionActionId: action.id });
	});
	await request("PATCH", endpoint, 200, owner, { interfaceLocale: "en" });
	await request("PATCH", "/account/me/privacy", 200, owner, { progressVisibility: "private" });
	const restricted = Value.Decode(PreferencesResponse, await request("GET", endpoint, 200, owner));
	await request("PUT", endpoint, 403, owner, replacement(restricted));

	const rotating = await actor();
	await readOwnPreferences(rotating.context, "en");
	await race(
		async (tx) => {
			await tx.select().from(users).where(eq(users.id, rotating.account.id)).for("update");
			await tx
				.update(sessions)
				.set({ token: randomUUID() })
				.where(eq(sessions.id, rotating.session.id));
		},
		(tx) =>
			withDatabaseTransactionContext(tx, () =>
				updateOwnDisplayPreferences(rotating.context, { interfaceLocale: "fr" }),
			),
		(result) => assert.rejects(result, AccessDenied),
	);
	assertions++;
	check(
		(
			await database
				.select()
				.from(accountPreference)
				.where(eq(accountPreference.authUserId, rotating.account.id))
		)[0]?.interfaceLocale,
		"en",
		"changed credential cannot update after its account-lock wait",
	);
	const erased = await actor();
	await readOwnPreferences(erased.context);
	await race(
		(tx) => eraseOwnAccount(tx, erased.context),
		(tx) =>
			withDatabaseTransactionContext(tx, () =>
				updateOwnDisplayPreferences(erased.context, { interfaceLocale: "fr" }),
			),
		(result) => assert.rejects(result, AccountClosed),
	);
	assertions++;
	const expired = await actor();
	await database
		.update(sessions)
		.set({ expiresAt: new Date(0) })
		.where(eq(sessions.id, expired.session.id));
	await assert.rejects(() => readOwnPreferences(expired.context), AccessDenied);
	assertions++;
	check(
		(
			await database
				.select()
				.from(accountPreference)
				.where(eq(accountPreference.authUserId, expired.account.id))
		).length,
		0,
		"expired credential cannot initialize private defaults",
	);
	const root = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-native-account-preferences.ts",
		"services/main/src/services/account/preferences.ts",
		"services/main/src/services/account/preference-contracts.ts",
		"services/main/src/services/participation/membership-policy.ts",
		"services/main/src/services/realms/membership-policy.ts",
		"services/main/src/services/realms/roster.ts",
		"services/main/src/services/api/users/index.ts",
		"services/main/src/services/api/users/schema.ts",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, root)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(root),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			assertions,
			httpChecks,
			scope:
				"Native private settings initialization/HTTP, direct selection, verified-write versus personal controls, API key/session policy, Realm hints and exact credential/erasure lock races. Privileged actor/Realm/enforcement setup is fixture-only; no whole-account onboarding or frontend acceptance.",
		}),
	);
} finally {
	await pool.end();
	await database.$client.end();
	await observability.shutdown();
}
