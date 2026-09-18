import { parseContentLanguageTag } from "@rezics/content-language";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { catalogDefinition as definitions, catalogDefinitionRevision as revisions } from "@rezics/schema/postgres/catalog/identity";
import { catalogDefinitionLabel as labels, catalogDefinitionReview as reviews } from "@rezics/schema/postgres/knowledge/definition-governance";
import { platformCapabilityGrant } from "@rezics/schema/postgres/realms/realm";
import { PlatformAuthorization } from "../authorization/platform/authorization";
import { AccountAuthorization } from "../authorization/account/authorization";
import { currentParticipationAuthority, ParticipationDenied, requireParticipation } from "../participation/policy";
import { CatalogReferenceNotFound, CatalogRevisionConflict } from "./storage";
import { reviseCatalogDefinition, validateCatalogDefinitionMeaning } from "./definitions";
import {
	CatalogDefinitionQuerySchema, CatalogDefinitionPageSchema, CatalogDefinitionRevisionSchema,
	CatalogDefinitionHistorySchema, CatalogDefinitionHistoryQuerySchema,
	CreateCatalogDefinitionSchema, ReviseCatalogDefinitionSchema,
	CatalogDefinitionRevisionLabelsQuerySchema, CatalogDefinitionRevisionLabelsSchema,
} from "./definition-api-contracts";

async function definitionManager(tx: DatabaseTransaction, actor: string) {
	const authority = currentParticipationAuthority();
	if (!authority || authority.principal.kind !== "auth" || authority.principal.authUserId !== actor || authority.grant)
		throw new ParticipationDenied("Definition governance requires a direct current account");
	await requireParticipation(tx, authority, "entity.security", { owner: "entity", id: authority.actingEntityId });
	await new AccountAuthorization(actor).ensureCanContribute(tx);
	await new PlatformAuthorization(authority.actingEntityId, actor).ensureCapability("catalog.definition.manage", tx);
	const [grant] = await tx.select({ id: platformCapabilityGrant.id }).from(platformCapabilityGrant)
		.where(and(eq(platformCapabilityGrant.authUserId, actor), eq(platformCapabilityGrant.capability, "catalog.definition.manage"),
			isNull(platformCapabilityGrant.revokedAt), or(isNull(platformCapabilityGrant.expiresAt), sql`${platformCapabilityGrant.expiresAt}>clock_timestamp()`)))
		.limit(1).for("share");
	if (!grant) throw new ParticipationDenied();
	return grant.id;
}

export async function catalogDefinitionPermissions(tx: DatabaseTransaction, actor: string | null) {
	const authority = currentParticipationAuthority();
	if (!actor || !authority || authority.grant || authority.principal.kind !== "auth") return { canManage: false };
	return { canManage: await new PlatformAuthorization(authority.actingEntityId, actor).hasCapability("catalog.definition.manage", tx) };
}

function labelPreference(languageTag?: string) {
	const language = languageTag ? parseContentLanguageTag(languageTag).tag : "en";
	const base = language.split("-")[0] ?? language;
	return sql`case when ${labels.languageTag}=${language} then 0 when ${labels.languageTag}=${base} then 1 when ${labels.languageTag}='en' then 2 else 3 end`;
}

/** Exact definition labels hydrate a bounded dependency page without one HTTP request per role or member. */
export async function readCatalogDefinitionRevisionLabels(tx: DatabaseTransaction, input: z.input<typeof CatalogDefinitionRevisionLabelsQuerySchema>) {
	const query = CatalogDefinitionRevisionLabelsQuerySchema.parse(input), ids = [...new Set(query.ids)];
	const candidates = tx.select({ id: revisions.id, definitionId: revisions.definitionId, version: revisions.version, kind: definitions.kind })
		.from(revisions).innerJoin(definitions, eq(definitions.id, revisions.definitionId)).where(inArray(revisions.id, ids)).limit(32).as("label_candidates");
	const label = tx.select({ languageTag: labels.languageTag, label: labels.label }).from(labels)
		.where(eq(labels.definitionRevisionId, candidates.id)).orderBy(labelPreference(query.languageTag), labels.languageTag).limit(1).as("dependency_label");
	const rows = await tx.select({ id: candidates.id, definitionId: candidates.definitionId, kind: candidates.kind, version: candidates.version,
		label: { languageTag: label.languageTag, label: label.label } }).from(candidates).leftJoinLateral(label, sql`true`);
	if (rows.length !== ids.length) throw new CatalogReferenceNotFound("Definition dependency is missing");
	const byId = new Map(rows.map(row => [row.id, row]));
	return CatalogDefinitionRevisionLabelsSchema.parse({ items: ids.map(id => byId.get(id)) });
}

/** The indexed candidate page is fixed before bounded per-definition revision/name lookups. */
export async function pageCatalogDefinitions(tx: DatabaseTransaction, input: z.input<typeof CatalogDefinitionQuerySchema>) {
	const query = CatalogDefinitionQuerySchema.parse(input);
	const candidates = tx.select({ id: definitions.id, namespace: definitions.namespace, key: definitions.key, kind: definitions.kind })
		.from(definitions).where(and(query.kind ? eq(definitions.kind, query.kind) : undefined,
			query.namespace ? eq(definitions.namespace, query.namespace) : undefined,
			query.afterNamespace && query.afterKey ? sql`(${definitions.namespace},${definitions.key}) > (${query.afterNamespace},${query.afterKey})` : undefined))
		.orderBy(definitions.namespace, definitions.key).limit(query.limit).as("definition_candidates");
	const current = tx.select({ id: revisions.id, version: revisions.version, valueKind: revisions.valueKind }).from(revisions)
		.where(eq(revisions.definitionId, candidates.id)).orderBy(desc(revisions.version)).limit(1).as("current_meaning");
	const label = tx.select({ languageTag: labels.languageTag, label: labels.label }).from(labels)
		.where(eq(labels.definitionRevisionId, current.id)).orderBy(labelPreference(query.languageTag), labels.languageTag).limit(1).as("preferred_label");
	const rows = await tx.select({ identity: { id: candidates.id, namespace: candidates.namespace, key: candidates.key, kind: candidates.kind },
		current: { id: current.id, version: current.version, valueKind: current.valueKind }, label: { languageTag: label.languageTag, label: label.label } }).from(candidates)
		.leftJoinLateral(current, sql`true`).leftJoinLateral(label, sql`true`).orderBy(candidates.namespace, candidates.key);
	const last = rows.at(-1)?.identity;
	return CatalogDefinitionPageSchema.parse({
		items: rows.map(row => ({ ...row.identity, current: row.current ? { ...row.current, label: row.label } : null })),
		after: rows.length === query.limit && last ? { afterNamespace: last.namespace, afterKey: last.key } : null,
	});
}

export async function readCatalogDefinitionRevision(tx: DatabaseTransaction, id: string) {
	z.uuid().parse(id);
	const [row] = await tx.select({ revision: revisions, reviewedId: reviews.definitionRevisionId }).from(revisions)
		.leftJoin(reviews, eq(reviews.definitionRevisionId, revisions.id)).where(eq(revisions.id, id)).limit(1);
	if (!row) throw new CatalogReferenceNotFound("Definition revision is missing");
	const names = await tx.select({ languageTag: labels.languageTag, label: labels.label, description: labels.description })
		.from(labels).where(eq(labels.definitionRevisionId, id)).orderBy(labels.languageTag).limit(32);
	return CatalogDefinitionRevisionSchema.parse({ ...row.revision, labels: names, createdAt: row.revision.createdAt.toISOString(), reviewed: row.reviewedId !== null });
}

export async function readCatalogDefinition(tx: DatabaseTransaction, id: string) {
	z.uuid().parse(id);
	const [identity] = await tx.select({ id: definitions.id, namespace: definitions.namespace, key: definitions.key, kind: definitions.kind })
		.from(definitions).where(eq(definitions.id, id)).limit(1);
	if (!identity) throw new CatalogReferenceNotFound("Definition is missing");
	const [current] = await tx.select({ id: revisions.id }).from(revisions).where(eq(revisions.definitionId, id))
		.orderBy(desc(revisions.version)).limit(1);
	return { ...identity, current: current ? await readCatalogDefinitionRevision(tx, current.id) : null };
}

export async function pageCatalogDefinitionHistory(tx: DatabaseTransaction, id: string, input: z.input<typeof CatalogDefinitionHistoryQuerySchema>) {
	z.uuid().parse(id);
	const query = CatalogDefinitionHistoryQuerySchema.parse(input);
	const [identity] = await tx.select({ id: definitions.id }).from(definitions).where(eq(definitions.id, id)).limit(1);
	if (!identity) throw new CatalogReferenceNotFound("Definition is missing");
	const candidates = tx.select({ id: revisions.id, version: revisions.version, valueKind: revisions.valueKind }).from(revisions)
		.where(and(eq(revisions.definitionId, id), query.afterVersion ? lt(revisions.version, query.afterVersion) : undefined))
		.orderBy(desc(revisions.version)).limit(query.limit).as("revision_candidates");
	const label = tx.select({ languageTag: labels.languageTag, label: labels.label }).from(labels)
		.where(eq(labels.definitionRevisionId, candidates.id)).orderBy(labelPreference(query.languageTag), labels.languageTag).limit(1).as("revision_label");
	const rows = await tx.select({ revision: { id: candidates.id, version: candidates.version, valueKind: candidates.valueKind },
		label: { languageTag: label.languageTag, label: label.label } }).from(candidates).leftJoinLateral(label, sql`true`).orderBy(desc(candidates.version));
	return CatalogDefinitionHistorySchema.parse({ items: rows.map(row => ({ ...row.revision, label: row.label })),
		afterVersion: rows.length === query.limit ? rows.at(-1)?.revision.version ?? null : null });
}

async function sealDefinitionReview(tx: DatabaseTransaction, actor: string, grantId: string, revisionId: string,
	input: Pick<z.infer<typeof CreateCatalogDefinitionSchema>, "labels" | "reason">) {
	await tx.insert(labels).values(input.labels.map((label, position) => ({
		...label, languageTag: parseContentLanguageTag(label.languageTag).tag, position, definitionRevisionId: revisionId,
	})));
	await tx.insert(reviews).values({ definitionRevisionId: revisionId, authUserId: actor, grantId, reason: input.reason });
	return readCatalogDefinitionRevision(tx, revisionId);
}

/** A new identity, validated grammar, localized names and current human grant commit together. */
export async function createCatalogDefinition(tx: DatabaseTransaction, actor: string, input: z.input<typeof CreateCatalogDefinitionSchema>) {
	const value = CreateCatalogDefinitionSchema.parse(input);
	const grantId = await definitionManager(tx, actor);
	const constraints = await validateCatalogDefinitionMeaning(tx, value.kind, value);
	const [identity] = await tx.insert(definitions).values({ namespace: value.namespace, key: value.key, kind: value.kind }).onConflictDoNothing().returning();
	if (!identity) throw new CatalogRevisionConflict("Definition namespace and key already exist");
	const [revision] = await tx.insert(revisions).values({ definitionId: identity.id, version: 1, valueKind: value.valueKind, constraints }).returning();
	if (!revision) throw new Error("Definition revision was not created");
	return sealDefinitionReview(tx, actor, grantId, revision.id, value);
}

/** Changed meaning creates a new immutable revision; existing facts retain their exact revision. */
export async function reviseCatalogApiDefinition(tx: DatabaseTransaction, actor: string, id: string, input: z.input<typeof ReviseCatalogDefinitionSchema>) {
	z.uuid().parse(id);
	const value = ReviseCatalogDefinitionSchema.parse(input);
	const grantId = await definitionManager(tx, actor);
	const [identity] = await tx.select({ id: definitions.id }).from(definitions).where(eq(definitions.id, id)).limit(1).for("update");
	if (!identity) throw new CatalogReferenceNotFound("Definition is missing");
	const [head] = await tx.select({ version: revisions.version }).from(revisions).where(eq(revisions.definitionId, id)).orderBy(desc(revisions.version)).limit(1);
	if (head?.version !== value.expectedVersion) throw new CatalogRevisionConflict("Definition head changed");
	const revision = await reviseCatalogDefinition(tx, id, value.expectedVersion, value);
	return sealDefinitionReview(tx, actor, grantId, revision.id, value);
}
