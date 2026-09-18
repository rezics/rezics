import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { readCatalogAuthorityScope, catalogIdentityReadPredicate } from "../participation/policy";
import type { DatabaseTransaction } from "../database";
import {
	distributionPackage,
	distributionManifest,
	distributionMember,
	distributionRevision,
} from "@rezics/schema/postgres/publishing/distribution";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	assertReadableTargets,
	createCatalogIdentity,
	loadCatalogIdentity,
	CatalogReferenceNotFound,
	CatalogRevisionConflict,
} from "./storage";

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const text = (bytes: number) =>
	z
		.string()
		.min(1)
		.refine((value) => Buffer.byteLength(value, "utf8") <= bytes);

/** Concrete distributed content; organizational groups and nested packages are not targets.
 * @alpha
 * @remarks Provider-independent authoring contract. Each target retains its own access and rights.
 */
export const DistributionTargetSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("publication"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("text_version"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("software_content"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("software_release"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("music_release"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("recording"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("program_version"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("episode"), id: z.uuid() }),
]);
export type DistributionTarget = z.infer<typeof DistributionTargetSchema>;
const targets = {
	publication: { owner: "publishing", column: "publicationId" },
	text_version: { owner: "publishing", column: "textVersionId" },
	software_content: { owner: "software", column: "softwareContentId" },
	software_release: { owner: "software", column: "softwareReleaseId" },
	music_release: { owner: "music", column: "musicReleaseId" },
	recording: { owner: "music", column: "recordingId" },
	program_version: { owner: "program", column: "programVersionId" },
	episode: { owner: "program", column: "episodeId" },
} as const;
const targetKinds = [
	"publication",
	"text_version",
	"software_content",
	"software_release",
	"music_release",
	"recording",
	"program_version",
	"episode",
] as const;
const targetReference = (target: DistributionTarget): CatalogReference => ({
	owner: targets[target.kind].owner,
	id: target.id,
});

/** Bounded append batch with stable occurrence IDs, ordinal order and independent original numbering.
 * @alpha
 * @remarks Unknown quantity is null; zero is not a physical quantity. Repeated targets are intentional.
 */
export const DistributionMemberBatchSchema = z
	.array(
		z.strictObject({
			occurrenceId: z.uuid(),
			target: DistributionTargetSchema,
			originalNumber: text(1024).nullable(),
			quantity: integer.min(1).nullable(),
		}),
	)
	.min(1)
	.max(128)
	.superRefine((rows, ctx) => {
		if (new Set(rows.map((row) => row.occurrenceId)).size !== rows.length)
			ctx.addIssue({
				code: "custom",
				message: "An occurrence ID may appear only once per manifest",
			});
	});
export const DistributionRevisionValuesSchema = z.strictObject({ label: text(4096).nullable() });
type RevisionValues = z.infer<typeof DistributionRevisionValuesSchema>;
const packageReference = (id: string): CatalogReference => ({
	owner: "distribution",
	id: z.uuid().parse(id),
});

async function requirePackage(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string | null,
	write: boolean,
) {
	const identity = await loadCatalogIdentity(
		tx,
		packageReference(packageId),
		actor,
		write,
		"share",
	);
	if (identity.shape !== "package") throw new TypeError("Expected distribution package identity");
}

/** Create a package and its editable staging manifest without any source identifier.
 * @alpha
 * @remarks Uses the existing creator-only native catalog write policy; publication is separate.
 */
export async function createDistributionPackage(tx: DatabaseTransaction, actor: string) {
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "distribution", shape: "package" },
		actor,
	);
	await tx.insert(distributionPackage).values({ id: identity.id });
	const manifest = await beginDistributionManifest(tx, identity.id, actor);
	return { ...identity, packageRevision: 0, manifestId: manifest.id };
}

/** Start a complete replacement manifest; callers stream large compositions in bounded batches.
 * @alpha
 * @remarks Reuse occurrence IDs for retained occurrences when editing. No whole-package payload is required.
 */
export async function beginDistributionManifest(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string,
) {
	await requirePackage(tx, packageId, actor, true);
	const [manifest] = await tx.insert(distributionManifest).values({ packageId }).returning();
	if (!manifest) throw new Error("Manifest insertion returned no row");
	return manifest;
}

/** Append at most 128 occurrences with optimistic prefix control.
 * @alpha
 * @remarks Concrete subtype foreign keys reject missing or wrong-shape targets. Rights never propagate.
 */
export async function appendDistributionMembers(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string,
	manifestId: string,
	expectedCount: number,
	input: z.input<typeof DistributionMemberBatchSchema>,
) {
	z.uuid().parse(manifestId);
	integer.parse(expectedCount);
	const rows = DistributionMemberBatchSchema.parse(input);
	integer.parse(expectedCount + rows.length);
	await requirePackage(tx, packageId, actor, true);
	const [manifest] = await tx
		.select()
		.from(distributionManifest)
		.where(
			and(eq(distributionManifest.packageId, packageId), eq(distributionManifest.id, manifestId)),
		)
		.for("update")
		.limit(1);
	if (!manifest) throw new CatalogReferenceNotFound("Distribution manifest is missing");
	if (manifest.sealedAt !== null || manifest.memberCount !== expectedCount)
		throw new CatalogRevisionConflict("Distribution manifest prefix changed or is sealed");
	await assertReadableTargets(
		tx,
		rows.map((row) => targetReference(row.target)),
		actor,
	);
	await tx.insert(distributionMember).values(
		rows.map((row, offset) => ({
			packageId,
			manifestId,
			occurrenceId: row.occurrenceId,
			position: expectedCount + offset,
			originalNumber: row.originalNumber,
			quantity: row.quantity,
			[targets[row.target.kind].column]: row.target.id,
		})),
	);
	return { manifestId, memberCount: expectedCount + rows.length };
}

/** Seal a complete prefix and atomically publish its revision using an expected current revision.
 * @alpha
 * @remarks Sealing, publication and history append are one transaction; empty packages are valid drafts.
 */
export async function publishDistributionManifest(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string,
	manifestId: string,
	expectedRevision: number,
	expectedCount: number,
	input: RevisionValues,
) {
	z.uuid().parse(manifestId);
	integer.max(Number.MAX_SAFE_INTEGER - 1).parse(expectedRevision);
	integer.parse(expectedCount);
	const values = DistributionRevisionValuesSchema.parse(input);
	await requirePackage(tx, packageId, actor, true);
	const [head] = await tx
		.select()
		.from(distributionPackage)
		.where(eq(distributionPackage.id, packageId))
		.for("update")
		.limit(1);
	if (!head) throw new CatalogReferenceNotFound("Distribution package is missing");
	if (head.currentRevision !== expectedRevision)
		throw new CatalogRevisionConflict("Distribution package revision changed");
	const [manifest] = await tx
		.select()
		.from(distributionManifest)
		.where(
			and(eq(distributionManifest.packageId, packageId), eq(distributionManifest.id, manifestId)),
		)
		.for("update")
		.limit(1);
	if (!manifest) throw new CatalogReferenceNotFound("Distribution manifest is missing");
	if (manifest.memberCount !== expectedCount)
		throw new CatalogRevisionConflict("Distribution manifest prefix changed");
	if (manifest.sealedAt === null)
		await tx
			.update(distributionManifest)
			.set({ sealedAt: new Date() })
			.where(eq(distributionManifest.id, manifestId));
	const revision = expectedRevision + 1;
	await tx
		.insert(distributionRevision)
		.values({ packageId, revision, manifestId, ...values, createdByAuthUserId: actor });
	await tx
		.update(distributionPackage)
		.set({ currentRevision: revision })
		.where(eq(distributionPackage.id, packageId));
	return { packageId, revision, manifestId, memberCount: manifest.memberCount, ...values };
}

/** Read a current or pinned historical header. The manifest can then be exported page by page.
 * @alpha
 * @remarks A package does not grant visibility into any of its targets.
 */
export async function readDistributionPackage(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string | null,
	revision?: number,
) {
	if (revision !== undefined) integer.min(1).parse(revision);
	await requirePackage(tx, packageId, actor, false);
	const r = distributionRevision,
		p = distributionPackage,
		m = distributionManifest;
	const [row] = await tx
		.select({
			packageId: r.packageId,
			revision: r.revision,
			manifestId: r.manifestId,
			label: r.label,
			memberCount: m.memberCount,
			createdAt: r.createdAt,
		})
		.from(r)
		.innerJoin(p, eq(p.id, r.packageId))
		.innerJoin(m, and(eq(m.packageId, r.packageId), eq(m.id, r.manifestId)))
		.where(
			and(
				eq(r.packageId, packageId),
				revision === undefined ? eq(r.revision, p.currentRevision) : eq(r.revision, revision),
			),
		)
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Distribution package revision is missing");
	return row;
}

function decodeMember(row: typeof distributionMember.$inferSelect) {
	const present = targetKinds.flatMap((kind) => {
		const id = row[targets[kind].column];
		return id === null ? [] : [{ kind, id }];
	});
	if (present.length !== 1)
		throw new TypeError("Distribution member requires exactly one concrete target");
	const target = DistributionTargetSchema.parse(present[0]);
	return {
		occurrenceId: row.occurrenceId,
		position: row.position,
		originalNumber: row.originalNumber,
		quantity: row.quantity,
		target,
	};
}

/** Export at most 128 members from a pinned revision using its last ordinal as cursor.
 * @alpha
 * @remarks Unreadable targets fail the whole page without returning member metadata or identifiers.
 */
export async function readDistributionMembers(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string | null,
	revision: number,
	afterPosition = -1,
	limit = 100,
) {
	z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).parse(afterPosition);
	z.number().int().min(1).max(128).parse(limit);
	const header = await readDistributionPackage(tx, packageId, actor, revision);
	const t = distributionMember;
	const rows = (
		await tx
			.select()
			.from(t)
			.where(
				and(
					eq(t.packageId, packageId),
					eq(t.manifestId, header.manifestId),
					gt(t.position, afterPosition),
				),
			)
			.orderBy(t.position)
			.limit(limit)
	).map(decodeMember);
	await assertReadableTargets(
		tx,
		rows.map((row) => targetReference(row.target)),
		actor,
	);
	return rows;
}

/** Page immutable revision headers without traversing their potentially large manifests.
 * @alpha
 * @remarks Member access is rechecked separately on every export page, including old revisions.
 */
export async function readDistributionHistory(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string | null,
	afterRevision = 0,
	limit = 100,
) {
	integer.parse(afterRevision);
	z.number().int().min(1).max(128).parse(limit);
	await requirePackage(tx, packageId, actor, false);
	return tx
		.select({
			packageId: distributionRevision.packageId,
			revision: distributionRevision.revision,
			manifestId: distributionRevision.manifestId,
			label: distributionRevision.label,
			createdAt: distributionRevision.createdAt,
		})
		.from(distributionRevision)
		.where(
			and(
				eq(distributionRevision.packageId, packageId),
				gt(distributionRevision.revision, afterRevision),
			),
		)
		.orderBy(distributionRevision.revision)
		.limit(limit);
}

/** Restore complete old values as a new revision without copying any member rows.
 * @alpha
 * @remarks Restoration cannot resurrect retired target identities or bypass their current access policy.
 */
export async function restoreDistributionPackage(
	tx: DatabaseTransaction,
	packageId: string,
	actor: string,
	expectedRevision: number,
	restoreRevision: number,
) {
	const old = await readDistributionPackage(tx, packageId, actor, restoreRevision);
	return publishDistributionManifest(
		tx,
		packageId,
		actor,
		old.manifestId,
		expectedRevision,
		old.memberCount,
		{ label: old.label },
	);
}

/** Query current package occurrences of a concrete target with an indexed keyset and bounded candidates.
 * @alpha
 * @remarks Historical memberships are excluded; this query does not transfer rights or grouping membership.
 */
export async function queryDistributionPackages(
	tx: DatabaseTransaction,
	actor: string | null,
	input: DistributionTarget,
	after?: { packageId: string; manifestId: string; position: number },
	limit = 100,
) {
	const target = DistributionTargetSchema.parse(input);
	if (after !== undefined)
		z.strictObject({ packageId: z.uuid(), manifestId: z.uuid(), position: integer }).parse(after);
	z.number().int().min(1).max(128).parse(limit);
	await assertReadableTargets(tx, [targetReference(target)], actor);
	const t = distributionMember,
		p = distributionPackage,
		r = distributionRevision;
	const identity = CatalogIdentityTables.distribution;
	const scope = await readCatalogAuthorityScope(tx, actor);
	// Bound historical candidates before checking live heads: a popular target may have billions of old occurrences.
	const candidates = await tx
		.select({ packageId: t.packageId, manifestId: t.manifestId, position: t.position })
		.from(t)
		.where(
			and(
				eq(t[targets[target.kind].column], target.id),
				after
					? sql`(${t.packageId}, ${t.manifestId}, ${t.position}) > (${after.packageId}::uuid, ${after.manifestId}::uuid, ${after.position}::bigint)`
					: undefined,
			),
		)
		.orderBy(t.packageId, t.manifestId, t.position)
		.limit(limit);
	const last = candidates.at(-1);
	if (!last) return { items: [], nextCursor: null };
	const heads = await tx
		.select({ packageId: p.id, revision: p.currentRevision, manifestId: r.manifestId })
		.from(p)
		.innerJoin(r, and(eq(r.packageId, p.id), eq(r.revision, p.currentRevision)))
		.innerJoin(identity, eq(identity.id, p.id))
		.where(
			and(
				inArray(p.id, [...new Set(candidates.map((row) => row.packageId))]),
				catalogIdentityReadPredicate(scope, "distribution", identity),
			),
		)
		.orderBy(p.id)
		.limit(limit);
	return {
		items: heads.filter((head) =>
			candidates.some(
				(candidate) =>
					candidate.packageId === head.packageId && candidate.manifestId === head.manifestId,
			),
		),
		nextCursor: last,
	};
}
