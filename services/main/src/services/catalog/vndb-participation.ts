import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { catalogSourceMappingClaim } from "../database/schema/catalog-source";
import { softwareParticipationSourceOccurrence } from "../database/schema/catalog-software";
import { softwareParticipationCreditSourceOccurrence } from "../database/schema/catalog-software-participation";
import type { CatalogReference } from "./contracts";
import { VndbVnSchema, vndbSourceKey } from "./vndb";
import { catalogSourceRecordId, type recordCatalogSourceDocument } from "./source-observations";
import { bindReferencedSourceIdentity } from "./source-references";
import { requireCatalogNameRevision } from "./names";
import { ensureCatalogDefinition } from "./storage";
import {
	createSoftwareParticipation,
	type SoftwareParticipationValues,
} from "./software-participation";

const roles = {
	scenario: "scenario_writer",
	director: "director",
	chardesign: "character_designer",
	art: "artist",
	music: "composer",
	songs: "vocalist",
	translator: "translator",
	editor: "editor",
	qa: "quality_assurance",
	staff: "staff",
} as const;
const roleSchema = z.enum([
	"scenario",
	"director",
	"chardesign",
	"art",
	"music",
	"songs",
	"translator",
	"editor",
	"qa",
	"staff",
]);
type Document = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;

/** @alpha @remarks VNDB eid is snapshot-local; voice credits do not imply an edition context. */
export function planVndbParticipation(input: unknown) {
	const record = VndbVnSchema.parse(input);
	const contexts = new Set((record.editions ?? []).map((value) => value.eid));
	const staff = (record.staff ?? []).map((entry, index) => {
		if (entry.eid !== null && !contexts.has(entry.eid))
			throw new TypeError("VNDB staff context is absent from the same snapshot");
		return {
			path: `/staff/${index}`,
			staffPath: `/staff/${index}/id`,
			staffId: entry.id,
			aliasId: entry.aid,
			expectedAlias: entry.original !== undefined ? (entry.original ?? entry.name) : undefined,
			contextKey: entry.eid === null ? null : String(entry.eid),
			characterId: null,
			characterPath: null,
			role: roles[roleSchema.parse(entry.role)],
			note: entry.note,
		};
	});
	const voice = (record.va ?? []).map((entry, index) => ({
		path: `/va/${index}`,
		staffPath: `/va/${index}/staff/id`,
		staffId: entry.staff.id,
		aliasId: entry.staff.aid ?? null,
		expectedAlias:
			entry.staff.original !== undefined ? (entry.staff.original ?? entry.staff.name) : undefined,
		contextKey: null,
		characterId: entry.character.id,
		characterPath: `/va/${index}/character/id`,
		role: "voice_actor",
		note: entry.note,
	}));
	return [...staff, ...voice];
}

/** @alpha @remarks Resolves an adopted staff alias to its immutable source-observed native name revision. */
export async function resolveVndbStaffAlias(
	tx: DatabaseTransaction,
	entityId: string,
	staffId: string,
	aid: number,
) {
	const sourceRecordId = catalogSourceRecordId(vndbSourceKey(staffId));
	const t = CatalogNameTables.entity.sourceOccurrence;
	const claims = catalogSourceMappingClaim;
	const [alias] = await tx
		.select({ id: t.nameId, revision: t.nameRevision })
		.from(t)
		.innerJoin(
			claims,
			and(
				eq(claims.sourceRecordId, t.sourceRecordId),
				eq(claims.observedSnapshotId, t.snapshotId),
				eq(claims.path, "/"),
				eq(claims.owner, "entity"),
			),
		)
		.where(
			and(
				eq(t.sourceRecordId, sourceRecordId),
				eq(t.ownerId, entityId),
				eq(t.namespace, "vndb.staff.alias"),
				eq(t.localKey, String(aid)),
			),
		)
		.limit(1);
	if (!alias) throw new Error(`VNDB staff alias dependency requires adoption: ${staffId}/${aid}`);
	return alias;
}

/** @alpha @remarks Imports credits after supporting staff aliases, retaining exact native context/name revisions. */
export async function appendVndbParticipation(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	input: unknown,
	document: Document,
	sourcePath: (path: string) => string = (path) => path,
) {
	const plan = planVndbParticipation(input);
	const cache: VndbParticipationResolutionCache = {
		targets: new Map(),
		aliases: new Map(),
		roles: new Map(),
	};
	const contexts = new Map<string, { id: string; revision: number }>();
	const created: { participationId: string; revision: number }[] = [];
	for (const item of plan) {
		let context: { id: string; revision: number } | null = null;
		if (item.contextKey !== null) {
			context = contexts.get(item.contextKey) ?? null;
			if (!context) {
				const t = softwareParticipationSourceOccurrence;
				const [row] = await tx
					.select({ id: t.contextId, revision: t.contextRevision })
					.from(t)
					.where(
						and(
							eq(t.sourceRecordId, document.record.id),
							eq(t.snapshotId, document.snapshot.id),
							eq(t.namespace, "editions"),
							eq(t.localKey, item.contextKey),
							eq(t.contentId, content.id),
						),
					)
					.limit(1);
				if (!row) throw new TypeError("VNDB snapshot context has no exact native revision");
				context = row;
				contexts.set(item.contextKey, context);
			}
		}
		const values = await resolveVndbParticipationValues(
			tx,
			actor,
			item,
			document,
			context,
			cache,
			sourcePath,
		);
		const participation = await createSoftwareParticipation(tx, content, actor, values);
		await tx.insert(softwareParticipationCreditSourceOccurrence).values({
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: sourcePath(item.path),
			contentId: content.id,
			participationId: participation.participationId,
			participationRevision: participation.revision,
		});
		created.push(participation);
	}
	return created;
}

export type VndbParticipationResolutionCache = {
	targets: Map<string, CatalogReference>;
	aliases: Map<string, { id: string; revision: number }>;
	roles: Map<string, string>;
};
/** @internal Resolve only reviewed native targets and exact alias revisions for one source credit. */
export async function resolveVndbParticipationValues(
	tx: DatabaseTransaction,
	actor: string,
	item: ReturnType<typeof planVndbParticipation>[number],
	document: Document,
	context: { id: string; revision: number } | null,
	cache: VndbParticipationResolutionCache,
	sourcePath: (path: string) => string = (path) => path,
): Promise<SoftwareParticipationValues> {
	const resolve = async (id: string, path: string, shape: "unresolved" | "character") => {
		let target = cache.targets.get(id);
		if (!target) {
			target = await bindReferencedSourceIdentity(tx, actor, {
				...vndbSourceKey(id),
				owner: "entity",
				shape,
				evidence: document.referenceAt(sourcePath(path)),
			});
			cache.targets.set(id, target);
		}
		return target;
	};
	const target = await resolve(item.staffId, item.staffPath, "unresolved");
	let alias: { id: string; revision: number } | null = null;
	if (item.aliasId !== null) {
		const key = `${item.staffId}/${item.aliasId}`;
		alias =
			cache.aliases.get(key) ??
			(await resolveVndbStaffAlias(tx, target.id, item.staffId, item.aliasId));
		if (item.expectedAlias !== undefined) {
			const exact = await requireCatalogNameRevision(tx, target, actor, alias.id, alias.revision);
			if (exact.value !== item.expectedAlias)
				throw new Error(
					"VNDB staff alias snapshot differs from the VN credit spelling; refresh the dependent observations",
				);
		}
		cache.aliases.set(key, alias);
	}
	let roleRevisionId = cache.roles.get(item.role);
	if (!roleRevisionId) {
		roleRevisionId = (
			await ensureCatalogDefinition(tx, {
				namespace: "catalog.participation_role",
				key: item.role,
				kind: "vocabulary",
				valueKind: null,
			})
		).revisionId;
		cache.roles.set(item.role, roleRevisionId);
	}
	const character =
		item.characterId && item.characterPath
			? await resolve(item.characterId, item.characterPath, "character")
			: null;
	return {
		entityId: target.id,
		name: alias,
		context,
		characterId: character?.id ?? null,
		roleRevisionId,
		note: item.note || null,
		state: "active",
	};
}
