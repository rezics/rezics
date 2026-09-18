import assert from "node:assert/strict";
import { eq, inArray, sql } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { z } from "zod";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "@rezics/schema/postgres/identity/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	CatalogCreatedSchema,
	CatalogMutationSchema,
	CatalogResourceSchema,
} from "../src/services/catalog/resource-contracts";
import { GrantSelectionSchema } from "../src/services/api/participation/schema";
import { encodeDomainCursor } from "../src/services/catalog/domain-api-pagination";
import { creditAttribution, unitAssociationProposal } from "@rezics/schema/postgres/identity/entity";
import { ParticipationAuthoritySchema } from "../src/services/participation/policy";

const expectedPort = "25435";
const expectedDatabase = "rezics_atlas_native_final_20260908";
const connectionString = process.env.DATABASE_URL;
const fixturePort = process.env.REZICS_CATALOG_FIXTURE_PORT;
const fixtureDatabase = process.env.REZICS_CATALOG_FIXTURE_DATABASE;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable API fixture required");
if (!fixturePort || !fixtureDatabase)
	throw new Error("Explicit REZICS_CATALOG_FIXTURE_PORT and REZICS_CATALOG_FIXTURE_DATABASE required");
const target = new URL(connectionString);
if (target.port === "15432")
	throw new Error(
		`Requires isolated loopback Atlas fixture 127.0.0.1:${expectedPort}/${expectedDatabase}`,
	);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port !== expectedPort ||
	target.port !== fixturePort ||
	target.pathname !== `/${expectedDatabase}` ||
	fixtureDatabase !== expectedDatabase ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error(
		`Requires isolated loopback Atlas fixture 127.0.0.1:${expectedPort}/${expectedDatabase}`,
	);

const observability = initializeObservability({
	service: {
		name: "rezics-native-attribution-policy-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
const { resolveIdentity } = await import("../src/services/auth/session");
api.compile();
const authContext = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
const coverage: string[] = [];

function covered(name: string) {
	coverage.push(name);
}

type Actor = { cookie: string; userId: string; entityId: string; authorizationRevision: number };

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
		return { ...row, entityId: entity.id, authorizationRevision: entity.authorizationRevision };
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
	return {
		cookie,
		userId: account.id,
		entityId: account.entityId,
		authorizationRevision: account.authorizationRevision,
	};
}

function apiRequest(
	method: string,
	path: string,
	body: unknown,
	cookie?: string,
	selection?: unknown,
) {
	const headers = new Headers({ Accept: "application/json" });
	if (cookie) headers.set("Cookie", cookie);
	if (body !== undefined) headers.set("Content-Type", "application/json");
	if (selection) headers.set("X-Rezics-Participation", JSON.stringify(selection));
	return new Request(`http://localhost:3001/api/v1${path}`, {
		method,
		headers,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

async function captureIdentity(
	path: string,
	cookie: string,
	fixture: Actor,
	permission: "unit:read" | "unit:update",
	selection?: unknown,
) {
	const resolved = await resolveIdentity(
		apiRequest("GET", path, undefined, cookie, selection),
		permission,
	);
	if (!("participation" in resolved))
		return {
			hasParticipation: false as const,
			principalAuthUserId: null,
			actingEntityId: null,
			authorization: resolved.authorization,
		};
	assert.equal(resolved.principal.authUserId, fixture.userId);
	assertions++;
	return {
		hasParticipation: true as const,
		principalAuthUserId: resolved.principal.authUserId,
		actingEntityId: resolved.actingEntityId,
		authorizationRevision: resolved.authorizationRevision,
		grant: resolved.participation.grant ?? null,
		authorization: resolved.authorization,
		participation: resolved.participation,
	};
}

async function request(
	method: string,
	path: string,
	body: unknown,
	expectedStatus: number,
	cookie?: string,
	selection?: unknown,
) {
	const response = await api.fetch(apiRequest(method, path, body, cookie, selection));
	const text = await response.text();
	assert.equal(response.status, expectedStatus, `${method} ${path}: ${text.slice(0, 2500)}`);
	assertions++;
	return { status: response.status, value: text ? (JSON.parse(text) as unknown) : null, text };
}

const EntitySummarySchema = z.object({
	id: z.uuid(),
	owner: z.literal("entity"),
	shape: z.string(),
	title: z.string().nullable().optional(),
	summary: z.string().nullable().optional(),
});
const CreditSchema = z.object({
	id: z.uuid(),
	role: z.string(),
	position: z.string(),
	creditedEntity: EntitySummarySchema,
});
const CreditListSchema = z.object({
	items: z.array(CreditSchema).max(100),
	nextCursor: z.string().nullable(),
});
const CandidateListSchema = z.object({
	items: z.array(EntitySummarySchema).max(50),
	nextCursor: z.string().nullable(),
});
const AssociationProposalSchema = z.object({
	id: z.uuid(),
	sourceUnitId: z.uuid(),
	targetUnitId: z.uuid(),
	direction: z.enum(["request", "invitation"]),
	createdByProfileId: z.uuid(),
	expiresAt: z.iso.datetime(),
	state: z.enum(["pending", "expired", "accepted", "declined", "cancelled"]),
	resolution: z.enum(["accepted", "declined", "cancelled"]).nullable(),
	resolvedAt: z.iso.datetime().nullable(),
	resolvedByProfileId: z.uuid().nullable(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	kind: z.enum(["credit", "subject"]),
	role: z.string(),
	contextPostId: z.uuid().nullable(),
});

const name = (value: string) => ({ value, languageTag: "en" as const });
const proposalExpiry = () => new Date(Date.now() + 3600000).toISOString();
const grantExpiry = () => new Date(Date.now() + 3600000).toISOString();

async function createWork(cookie: string, title: string) {
	const created = CatalogCreatedSchema.parse(
		(await request("POST", "/catalog/resources", { kind: "publishing_work", name: name(title) }, 200, cookie))
			.value,
	);
	const metadata = CatalogResourceSchema.parse(
		(
			await request(
				"GET",
				`/catalog/resources/${created.reference.owner}/${created.reference.id}`,
				undefined,
				200,
				cookie,
			)
		).value,
	);
	CatalogMutationSchema.parse(
		(
			await request(
				"PATCH",
				`/catalog/resources/${created.reference.owner}/${created.reference.id}/lifecycle`,
				{
					expectedRevision: metadata.revision,
					status: "published",
					visibility: "public",
					contentRating: "general",
				},
				200,
				cookie,
			)
		).value,
	);
	return created.reference;
}

function creditsPath(owner: string, unitId: string) {
	return `/resources/${owner}/${unitId}/credit-attributions`;
}

function requestPath(unitId: string) {
	return `/unit/${unitId}/association-proposals/requests`;
}

function acceptPath(unitId: string, proposalId: string) {
	return `/unit/${unitId}/association-proposals/${proposalId}/accept`;
}

function asGrant(actorEntityId: string, grant: z.infer<typeof GrantSelectionSchema>) {
	return { actingEntityId: actorEntityId, grant };
}

try {
	const sourceOwner = await actor("G56 attribution source owner");
	const other = await actor("G56 attribution other controller");
	const editor = await actor("G56 attribution editor");
	const revokeTarget = await actor("G56 attribution revoke-accept target");
	const source = await createWork(sourceOwner.cookie, "G56 native attribution source work");
	const credits = creditsPath(source.owner, source.id);

	const ownerIdentity = await captureIdentity(credits, sourceOwner.cookie, sourceOwner, "unit:update");
	assert.equal(ownerIdentity.hasParticipation, true);
	assert.equal(ownerIdentity.actingEntityId, sourceOwner.entityId);
	assert.equal(ownerIdentity.grant, null);
	assertions += 3;
	covered("resolveIdentity-current-authority");

	const empty = CreditListSchema.parse((await request("GET", credits, undefined, 200, sourceOwner.cookie)).value);
	assert.equal(empty.items.length, 0);
	assertions++;

	const ownCredit = CreditSchema.parse(
		(
			await request(
				"POST",
				credits,
				{ creditedEntityId: sourceOwner.entityId, role: "author" },
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	assert.equal(ownCredit.creditedEntity.id, sourceOwner.entityId);
	assert.equal(ownCredit.role, "author");
	assertions += 2;
	covered("add-own-self-direct-200-native-catalog-edit-source");

	await request(
		"POST",
		credits,
		{ creditedEntityId: other.entityId, role: "translator" },
		403,
		sourceOwner.cookie,
	);
	covered("other-controller-target-denied-403-even-if-source-editor");

	assert.ok(ownerIdentity.hasParticipation);
	const ownerAuth = ownerIdentity.authorization;
	assert.ok(ownerAuth.profileId);
	const consent = await database.transaction(async (tx) => {
		const directSelf = await ownerAuth.entity.allowsAssociationCommand(
			tx,
			sourceOwner.entityId,
			"credit",
			"direct",
		);
		const requestSelf = await ownerAuth.entity.allowsAssociationCommand(
			tx,
			sourceOwner.entityId,
			"credit",
			"request",
		);
		const directOther = await ownerAuth.entity.allowsAssociationCommand(
			tx,
			other.entityId,
			"credit",
			"direct",
		);
		const requestOther = await ownerAuth.entity.allowsAssociationCommand(
			tx,
			other.entityId,
			"credit",
			"request",
		);
		return { directSelf, requestSelf, directOther, requestOther };
	});
	assert.equal(consent.directSelf, true);
	assert.equal(consent.directOther, false);
	assert.equal(consent.requestOther, true);
	assertions += 3;
	covered("allowsAssociationCommand-direct-false-request-true-current-authority");

	const catalogEditOnOther = GrantSelectionSchema.parse(
		(
			await request(
				"POST",
				"/participation/grants",
				{
					recipient: { kind: "account", entityId: sourceOwner.entityId },
					actingEntityId: sourceOwner.entityId,
					capability: "catalog.edit",
					target: { owner: "entity", id: other.entityId },
					expiresAt: grantExpiry(),
				},
				200,
				other.cookie,
			)
		).value,
	);
	await request(
		"POST",
		credits,
		{ creditedEntityId: other.entityId, role: "editor" },
		403,
		sourceOwner.cookie,
		asGrant(sourceOwner.entityId, catalogEditOnOther),
	);
	covered("foreign-native-entity-catalog-edit-grant-does-not-enable-target-direct");

	const sourceEditForOther = GrantSelectionSchema.parse(
		(
			await request(
				"POST",
				"/participation/grants",
				{
					recipient: { kind: "account", entityId: other.entityId },
					actingEntityId: other.entityId,
					capability: "catalog.edit",
					target: source,
					expiresAt: grantExpiry(),
				},
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	const otherGrantIdentity = await captureIdentity(
		credits,
		other.cookie,
		other,
		"unit:update",
		asGrant(other.entityId, sourceEditForOther),
	);
	assert.equal(otherGrantIdentity.hasParticipation, true);
	assert.equal(otherGrantIdentity.actingEntityId, other.entityId);
	assert.equal(otherGrantIdentity.grant?.id, sourceEditForOther.id);
	assert.equal(otherGrantIdentity.grant?.revision, sourceEditForOther.revision);
	assertions += 3;

	// Selected catalog.edit does not inherit ambient self entity.publish.
	await request(
		"POST",
		credits,
		{ creditedEntityId: other.entityId, role: "translator" },
		403,
		other.cookie,
		asGrant(other.entityId, sourceEditForOther),
	);
	covered("direct-credit-under-selected-catalog-edit-grant-403");

	const requested = AssociationProposalSchema.parse(
		(
			await request(
				"POST",
				requestPath(source.id),
				{
					targetUnitId: other.entityId,
					kind: "credit",
					role: "translator",
					expiresAt: proposalExpiry(),
				},
				200,
				other.cookie,
				asGrant(other.entityId, sourceEditForOther),
			)
		).value,
	);
	assert.equal(requested.direction, "request");
	assert.equal(requested.state, "pending");
	assert.equal(requested.sourceUnitId, source.id);
	assert.equal(requested.targetUnitId, other.entityId);
	assertions += 4;
	const storedRequest = await database
		.select({
			creatorAuthority: unitAssociationProposal.creatorAuthority,
			creatorGrantId: unitAssociationProposal.creatorGrantId,
			resolution: unitAssociationProposal.resolution,
		})
		.from(unitAssociationProposal)
		.where(eq(unitAssociationProposal.id, requested.id))
		.limit(1);
	const storedAuthority = ParticipationAuthoritySchema.parse(storedRequest[0]?.creatorAuthority);
	assert.equal(storedRequest[0]?.creatorGrantId, sourceEditForOther.id);
	assert.equal(storedAuthority.grant?.id, sourceEditForOther.id);
	assert.equal(storedAuthority.grant?.revision, sourceEditForOther.revision);
	assert.equal(storedRequest[0]?.resolution, null);
	assertions += 4;
	covered("source-grant-creates-association-request");

	const accepted = AssociationProposalSchema.parse(
		(
			await request(
				"POST",
				acceptPath(other.entityId, requested.id),
				{},
				200,
				other.cookie,
			)
		).value,
	);
	assert.equal(accepted.resolution, "accepted");
	assert.equal(accepted.state, "accepted");
	assert.equal(accepted.id, requested.id);
	assertions += 3;
	const afterAccept = CreditListSchema.parse(
		(await request("GET", `${credits}?limit=100`, undefined, 200, sourceOwner.cookie)).value,
	);
	assert.equal(
		afterAccept.items.some(
			(item) => item.id === accepted.id && item.creditedEntity.id === other.entityId && item.role === "translator",
		),
		true,
	);
	assertions++;
	covered("target-controller-accepts-in-self-personal-context");

	const publishGrant = GrantSelectionSchema.parse(
		(
			await request(
				"POST",
				"/participation/grants",
				{
					recipient: { kind: "account", entityId: sourceOwner.entityId },
					actingEntityId: other.entityId,
					capability: "entity.publish",
					target: { owner: "entity", id: other.entityId },
					expiresAt: grantExpiry(),
				},
				200,
				other.cookie,
			)
		).value,
	);
	await request(
		"POST",
		credits,
		{ creditedEntityId: other.entityId, role: "editor" },
		403,
		sourceOwner.cookie,
		asGrant(other.entityId, publishGrant),
	);
	covered("entity-publish-grant-selection-does-not-replace-source-catalog-edit");

	const sourceEditForEditor = GrantSelectionSchema.parse(
		(
			await request(
				"POST",
				"/participation/grants",
				{
					recipient: { kind: "account", entityId: editor.entityId },
					actingEntityId: editor.entityId,
					capability: "catalog.edit",
					target: source,
					expiresAt: grantExpiry(),
				},
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	const revokeRequest = AssociationProposalSchema.parse(
		(
			await request(
				"POST",
				requestPath(source.id),
				{
					targetUnitId: revokeTarget.entityId,
					kind: "credit",
					role: "illustrator",
					expiresAt: proposalExpiry(),
				},
				200,
				editor.cookie,
				asGrant(editor.entityId, sourceEditForEditor),
			)
		).value,
	);
	await request(
		"POST",
		`/participation/grants/${sourceEditForEditor.id}/revoke`,
		{ expectedRevision: sourceEditForEditor.revision },
		200,
		sourceOwner.cookie,
	);
	await request(
		"POST",
		acceptPath(revokeTarget.entityId, revokeRequest.id),
		{},
		403,
		revokeTarget.cookie,
	);
	const deniedProposal = await database
		.select({
			resolution: unitAssociationProposal.resolution,
		})
		.from(unitAssociationProposal)
		.where(eq(unitAssociationProposal.id, revokeRequest.id))
		.limit(1);
	assert.equal(deniedProposal[0]?.resolution, null);
	assertions++;
	const deniedCredit = await database
		.select({ id: creditAttribution.id })
		.from(creditAttribution)
		.where(eq(creditAttribution.id, revokeRequest.id))
		.limit(1);
	assert.equal(deniedCredit.length, 0);
	assertions++;
	covered("revoked-original-source-grant-accept-denied-no-accepted-row");

	const ownCandidatesEmpty = CandidateListSchema.parse(
		(
			await request(
				"GET",
				`/catalog/entity-candidates?mode=direct&limit=10`,
				undefined,
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	const ownCandidatesExact = CandidateListSchema.parse(
		(
			await request(
				"GET",
				`/catalog/entity-candidates?mode=direct&query=${sourceOwner.entityId}&limit=10`,
				undefined,
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	const otherDirect = CandidateListSchema.parse(
		(
			await request(
				"GET",
				`/catalog/entity-candidates?mode=direct&query=${other.entityId}&limit=10`,
				undefined,
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	assert.equal(ownCandidatesEmpty.items.length, 1);
	assert.equal(ownCandidatesEmpty.items[0]?.id, sourceOwner.entityId);
	assert.equal(ownCandidatesExact.items.length, 1);
	assert.equal(ownCandidatesExact.items[0]?.id, sourceOwner.entityId);
	assert.equal(
		otherDirect.items.some((item) => item.id === other.entityId),
		false,
	);
	assertions += 5;
	covered("entity-candidates-direct-own-self-not-other-public");

	const publicOwn = CandidateListSchema.parse(
		(
			await request(
				"GET",
				`/catalog/entity-candidates?mode=public&query=${sourceOwner.entityId}&limit=10`,
				undefined,
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	assert.equal(publicOwn.items.length, 1);
	assert.equal(publicOwn.items[0]?.id, sourceOwner.entityId);
	assertions += 2;
	const publicOther = CandidateListSchema.parse(
		(
			await request(
				"GET",
				`/catalog/entity-candidates?mode=public&query=${other.entityId}&limit=10`,
				undefined,
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	assert.equal(publicOther.items.length, 1);
	assert.equal(publicOther.items[0]?.id, other.entityId);
	assertions += 2;
	covered("entity-candidates-public-exact-uuid-200-actual-target");

	const third = await actor("G56 attribution revocation publish target");
	const thirdPublish = GrantSelectionSchema.parse(
		(
			await request(
				"POST",
				"/participation/grants",
				{
					recipient: { kind: "account", entityId: sourceOwner.entityId },
					actingEntityId: third.entityId,
					capability: "entity.publish",
					target: { owner: "entity", id: third.entityId },
					expiresAt: grantExpiry(),
				},
				200,
				third.cookie,
			)
		).value,
	);
	await request(
		"POST",
		`/participation/grants/${thirdPublish.id}/revoke`,
		{ expectedRevision: thirdPublish.revision },
		200,
		third.cookie,
	);
	await request(
		"POST",
		credits,
		{ creditedEntityId: third.entityId, role: "illustrator" },
		403,
		sourceOwner.cookie,
		asGrant(third.entityId, thirdPublish),
	);
	covered("missing-current-authority-revocation-enforced");

	const mismatchedCursor = encodeDomainCursor(`credits:music:${crypto.randomUUID()}`, {
		position: "a0",
		id: crypto.randomUUID(),
	});
	await request(
		"GET",
		`${credits}?cursor=${encodeURIComponent(mismatchedCursor)}`,
		undefined,
		422,
		sourceOwner.cookie,
	);
	covered("cursor-owner-scope-mismatch-422");
	const mismatchedCandidateCursor = encodeDomainCursor(`credits:music:${crypto.randomUUID()}`, {
		position: "a0",
		id: crypto.randomUUID(),
	});
	await request(
		"GET",
		`/catalog/entity-candidates?mode=public&query=${other.entityId}&cursor=${encodeURIComponent(mismatchedCandidateCursor)}`,
		undefined,
		422,
		sourceOwner.cookie,
	);
	covered("candidate-cursor-owner-scope-mismatch-422");
	await request("GET", `${credits}?limit=101`, undefined, 422, sourceOwner.cookie);
	covered("list-limit-bound-100");

	const listed = CreditListSchema.parse(
		(await request("GET", `${credits}?limit=100`, undefined, 200, sourceOwner.cookie)).value,
	);
	assert.ok(listed.items.length >= 1);
	assertions++;
	const removed = listed.items[0];
	assert.ok(removed);
	await request("DELETE", `${credits}/${removed.id}`, undefined, 204, sourceOwner.cookie);
	const afterRemove = CreditListSchema.parse(
		(await request("GET", `${credits}?limit=100`, undefined, 200, sourceOwner.cookie)).value,
	);
	assert.equal(
		afterRemove.items.some((item) => item.id === removed.id),
		false,
	);
	assertions++;
	covered("list-then-remove-credit");

	const volumeWork = await createWork(sourceOwner.cookie, "G56 native attribution volume work");
	const volumePath = creditsPath(volumeWork.owner, volumeWork.id);
	const createdCredits: { id: string; creditedEntityId: string }[] = [];
	for (let index = 0; index < 129; index++) {
		const extra = await actor(`G56 attribution volume ${index}`);
		const proposal = AssociationProposalSchema.parse(
			(
				await request(
					"POST",
					requestPath(volumeWork.id),
					{
						targetUnitId: extra.entityId,
						kind: "credit",
						role: "author",
						expiresAt: proposalExpiry(),
					},
					200,
					sourceOwner.cookie,
				)
			).value,
		);
		const acceptedVolume = AssociationProposalSchema.parse(
			(await request("POST", acceptPath(extra.entityId, proposal.id), {}, 200, extra.cookie)).value,
		);
		assert.equal(acceptedVolume.resolution, "accepted");
		assert.equal(acceptedVolume.id, proposal.id);
		assert.equal(acceptedVolume.targetUnitId, extra.entityId);
		assertions += 3;
		createdCredits.push({ id: acceptedVolume.id, creditedEntityId: extra.entityId });
	}
	assert.equal(createdCredits.length, 129);
	assertions++;
	const lastAccepted = createdCredits.at(-1);
	assert.ok(lastAccepted);
	const ownAfterPrefix = CreditSchema.parse(
		(
			await request(
				"POST",
				volumePath,
				{ creditedEntityId: sourceOwner.entityId, role: "editor" },
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	assert.equal(ownAfterPrefix.creditedEntity.id, sourceOwner.entityId);
	assertions++;
	covered("exact-post-return-after-prefix-129");

	const firstPage = CreditListSchema.parse(
		(await request("GET", `${volumePath}?limit=100`, undefined, 200, sourceOwner.cookie)).value,
	);
	assert.equal(firstPage.items.length, 100);
	assert.ok(firstPage.nextCursor);
	assertions += 2;
	assert.equal(
		firstPage.items.some((item) => item.id === lastAccepted.id),
		false,
	);
	assert.equal(
		firstPage.items.some((item) => item.id === ownAfterPrefix.id),
		false,
	);
	assertions += 2;
	const secondPage = CreditListSchema.parse(
		(
			await request(
				"GET",
				`${volumePath}?limit=100&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
				undefined,
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	const secondPageAgain = CreditListSchema.parse(
		(
			await request(
				"GET",
				`${volumePath}?limit=100&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
				undefined,
				200,
				sourceOwner.cookie,
			)
		).value,
	);
	assert.deepEqual(
		secondPage.items.map((item) => item.id),
		secondPageAgain.items.map((item) => item.id),
	);
	assertions++;
	assert.equal(secondPage.items.length, 30);
	assert.equal(secondPage.nextCursor, null);
	assertions += 2;
	const firstIds = new Set(firstPage.items.map((item) => item.id));
	assert.equal(
		secondPage.items.some((item) => firstIds.has(item.id)),
		false,
	);
	assert.equal(
		secondPage.items.some((item) => item.id === lastAccepted.id),
		true,
	);
	assert.equal(
		secondPage.items.some((item) => item.id === ownAfterPrefix.id),
		true,
	);
	assertions += 3;
	covered("get-pages-preserve-cursor");

	const persistedLast = await database
		.select({ id: creditAttribution.id, creditedEntityId: creditAttribution.creditedEntityId })
		.from(creditAttribution)
		.where(eq(creditAttribution.id, lastAccepted.id))
		.limit(1);
	assert.equal(persistedLast[0]?.id, lastAccepted.id);
	assert.equal(persistedLast[0]?.creditedEntityId, lastAccepted.creditedEntityId);
	assertions += 2;
	const persistedOwn = await database
		.select({ id: creditAttribution.id, creditedEntityId: creditAttribution.creditedEntityId })
		.from(creditAttribution)
		.where(eq(creditAttribution.id, ownAfterPrefix.id))
		.limit(1);
	assert.equal(persistedOwn[0]?.id, ownAfterPrefix.id);
	assert.equal(persistedOwn[0]?.creditedEntityId, sourceOwner.entityId);
	assertions += 2;
	covered("exact-post-return-does-not-depend-on-first-128-list");

	await request(
		"POST",
		credits,
		{ creditedEntityId: third.entityId, role: "letterer" },
		403,
		other.cookie,
	);
	covered("api-surface-denies-without-native-catalog-edit-not-old-unit-permission");

	const counted = await database.execute(
		sql`select count(*)::int as n from credit_attribution where source_unit_id = ${volumeWork.id}`,
	);
	assert.equal(z.object({ n: z.number() }).parse(counted.rows[0]).n, 130);
	assertions++;

	console.log(
		JSON.stringify({
			check: "native-attribution-policy",
			assertions,
			coverage,
			atlas: `${target.hostname}:${target.port}${target.pathname}`,
			consent,
			volumeAcceptedRequests: createdCredits.length,
			volumeDirectAfterPrefix: ownAfterPrefix.id,
			committedToDisposableTarget: true,
		}),
	);
} catch (error) {
	console.log(
		JSON.stringify({
			check: "native-attribution-policy",
			assertions,
			coverage,
			atlas: `${target.hostname}:${target.port}${target.pathname}`,
			failed: true,
			error:
				error instanceof Error
					? { name: error.name, message: error.message, stack: error.stack }
					: String(error),
		}),
	);
	throw error;
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
