import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import {
	CatalogNameAuthorityValuesSchema,
	CatalogRevisionNumberSchema,
	type CatalogNameAuthorityInput,
} from "./name-contracts";
import { CatalogPageSchema, type CatalogReference } from "./contracts";
import { CatalogRevisionConflict, loadCatalogIdentity } from "./storage";
import { requireCatalogNameRevision } from "./names";

async function authorityValues(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: CatalogNameAuthorityInput,
) {
	const values = CatalogNameAuthorityValuesSchema.parse(input);
	await loadCatalogIdentity(tx, reference, actor, true, "share");
	await requireCatalogNameRevision(tx, reference, actor, values.nameId, values.nameRevision);
	if (values.authorizerEntityId)
		await loadCatalogIdentity(
			tx,
			{ owner: "entity", id: values.authorizerEntityId },
			actor,
			values.reviewState === "verified",
			"share",
		);
	const { evidence, reviewEvidence, validFrom, validUntil, ...rest } = values;
	return {
		...rest,
		validFrom: validFrom ? new Date(validFrom) : null,
		validUntil: validUntil ? new Date(validUntil) : null,
		...evidence,
		reviewSourceRecordId: reviewEvidence?.sourceRecordId ?? null,
		reviewSnapshotId: reviewEvidence?.snapshotId ?? null,
		reviewSourcePath: reviewEvidence?.sourcePath ?? null,
	};
}

/**
 * Record a source claim or a scoped authorization with exact evidence revisions.
 * @alpha
 * @remarks Verified state requires the authenticated actor to control the named authorizer as well as the catalog target.
 */
export async function addCatalogNameAuthority(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: CatalogNameAuthorityInput,
) {
	const values = await authorityValues(tx, reference, actor, input),
		table = CatalogNameTables[reference.owner].authority;
	const [row] = await tx
		.insert(table)
		.values({ ...values, ownerId: reference.id, recordedByAuthUserId: actor })
		.returning();
	if (!row) throw new Error("Name authority insertion returned no row");
	return row;
}

/** @alpha @remarks Revocation, review, restoration and scope correction append complete immutable authority history. */
export async function reviseCatalogNameAuthority(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	id: string,
	expectedRevision: number,
	input: CatalogNameAuthorityInput,
) {
	z.uuid().parse(id);
	CatalogRevisionNumberSchema.parse(expectedRevision);
	const values = await authorityValues(tx, reference, actor, input),
		table = CatalogNameTables[reference.owner].authority;
	const [row] = await tx
		.update(table)
		.set({
			...values,
			revision: expectedRevision + 1,
			recordedAt: new Date(),
			recordedByAuthUserId: actor,
		})
		.where(
			and(eq(table.ownerId, reference.id), eq(table.id, id), eq(table.revision, expectedRevision)),
		)
		.returning();
	if (!row) throw new CatalogRevisionConflict("Name authority revision changed");
	return row;
}

/** @alpha @remarks Lists assertions for an exact target revision; stale approvals do not transfer to new text. */
export async function listCatalogNameAuthority(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	nameId: string,
	nameRevision: number,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	await requireCatalogNameRevision(tx, reference, actor, nameId, nameRevision);
	const page = CatalogPageSchema.parse(input),
		table = CatalogNameTables[reference.owner].authority;
	return tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.nameId, nameId),
				eq(table.nameRevision, nameRevision),
				page.afterId ? gt(table.id, page.afterId) : undefined,
			),
		)
		.orderBy(table.id)
		.limit(page.limit);
}

/** @alpha @remarks Historical decisions remain available after revocation or re-review. */
export async function readCatalogNameAuthorityHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	id: string,
	afterRevision = 0,
	limit = 50,
) {
	z.uuid().parse(id);
	z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(afterRevision);
	CatalogPageSchema.parse({ limit });
	await loadCatalogIdentity(tx, reference, actor, false);
	const table = CatalogNameTables[reference.owner].authorityRevision;
	return tx
		.select()
		.from(table)
		.where(
			and(eq(table.ownerId, reference.id), eq(table.id, id), gt(table.revision, afterRevision)),
		)
		.orderBy(table.revision)
		.limit(limit);
}

/** @alpha @remarks Resolves one scoped assertion without claiming absent evidence means unofficial. */
export function catalogNameAuthorityApplicability(
	input: CatalogNameAuthorityInput,
	target: {
		nameId: string;
		revision: number;
		territory: string | null;
		channel: string | null;
		context: string | null;
		at: Date;
	},
) {
	z.date().parse(target.at);
	const value = CatalogNameAuthorityValuesSchema.parse(input);
	if (
		value.state !== "active" ||
		value.nameId !== target.nameId ||
		value.nameRevision !== target.revision ||
		(value.territory !== null && value.territory !== target.territory) ||
		(value.channel !== null && value.channel !== target.channel) ||
		(value.context !== null && value.context !== target.context) ||
		(value.validFrom && target.at.getTime() < Date.parse(value.validFrom)) ||
		(value.validUntil && target.at.getTime() >= Date.parse(value.validUntil))
	)
		return "not_applicable";
	if (value.reviewState === "verified")
		return value.claim === "official"
			? "verified_official"
			: value.claim === "unofficial"
				? "verified_unofficial"
				: "unknown";
	if (value.reviewState === "source_claim") return "source_claim";
	return "unknown";
}
