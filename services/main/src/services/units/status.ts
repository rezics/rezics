import { and, asc, count, desc, eq, inArray, isNull, lt, max, min, or, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../database";
import { imageAssetContentUrl } from "../api/image-assets/service";
import {
	profile,
	unit,
	unitRevision,
	unitRevisionHead,
	unitStatusEvent,
	UnitStatusActorKindValues,
	UnitStatusValues,
} from "../database/schema";
import {
	primaryUnitSummary,
	primaryUnitTitle,
	resolvedUnitLocalizationImageAssetId,
} from "./localization";
import { UnitChanged, UnitNotFound, UnitPermissionForbidden } from "./errors";
import { ensureUnitVariantLifecycle } from "./variant-policy";
import {
	getPublicCanonicalUnitSlugAddresses,
	type PublicCanonicalUnitSlugAddress,
} from "./slug-address";

export type UnitStatus = (typeof UnitStatusValues)[number];
export type UnitStatusActorKind = (typeof UnitStatusActorKindValues)[number];
export type UnitStatusActor =
	| { readonly kind: "profile"; readonly profileId: string }
	| { readonly kind: "system" }
	| { readonly kind: "import" };

export type UnitStatusTransitionAuthorization =
	| { readonly kind: "interactive"; readonly publishAllowed: boolean }
	| { readonly kind: "trusted" };

export function crossesPublishedBoundary(fromStatus: UnitStatus, toStatus: UnitStatus): boolean {
	return fromStatus !== toStatus && (fromStatus === "published" || toStatus === "published");
}

export type UnitPublisherSummary = {
	readonly profileId: string;
	readonly slugAddress: PublicCanonicalUnitSlugAddress | null;
	readonly name: string | null;
	readonly summary: string | null;
	readonly avatar: { readonly id: string; readonly url: string } | null;
	readonly firstPublishedAt: Date;
	readonly lastPublishedAt: Date;
	readonly publicationCount: number;
};

export type UnitStatusEventView = {
	readonly id: string;
	readonly unitId: string;
	readonly fromStatus: UnitStatus | null;
	readonly toStatus: UnitStatus;
	readonly actor:
		| { readonly kind: "profile"; readonly profileId: string; readonly name: string | null }
		| { readonly kind: "system" }
		| { readonly kind: "import" }
		| { readonly kind: "hidden" };
	readonly revisionId: string | null;
	readonly createdAt: Date;
};

function actorColumns(actor: UnitStatusActor) {
	return actor.kind === "profile"
		? { actorKind: actor.kind, changedByProfileId: actor.profileId }
		: { actorKind: actor.kind, changedByProfileId: null };
}

async function lockStatus(tx: DatabaseTransaction, unitId: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-status:${unitId}`}::text, 0))`,
	);
}

export async function recordInitialUnitStatus(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly actor: UnitStatusActor;
		readonly revisionId?: string | null;
	},
): Promise<string> {
	await lockStatus(tx, input.unitId);
	const [current] = await tx
		.select({
			status: unit.status,
			publishedAt: unit.publishedAt,
			createdAt: unit.createdAt,
			deletedAt: unit.deletedAt,
		})
		.from(unit)
		.where(eq(unit.id, input.unitId))
		.limit(1);
	if (!current || current.deletedAt) throw new UnitNotFound();
	const [existing] = await tx
		.select({ id: unitStatusEvent.id })
		.from(unitStatusEvent)
		.where(and(eq(unitStatusEvent.unitId, input.unitId), isNull(unitStatusEvent.fromStatus)))
		.limit(1);
	if (existing) throw new Error(`Initial Unit status already recorded for ${input.unitId}`);
	const createdAt = current.status === "published" ? current.publishedAt : current.createdAt;
	if (!createdAt)
		throw new Error("A published Unit must have publishedAt before initial status recording");
	const [event] = await tx
		.insert(unitStatusEvent)
		.values({
			unitId: input.unitId,
			fromStatus: null,
			toStatus: current.status,
			...actorColumns(input.actor),
			revisionId: input.revisionId ?? null,
			createdAt,
		})
		.returning({ id: unitStatusEvent.id });
	if (!event) throw new Error("Initial Unit status insertion did not return an event");
	return event.id;
}

/**
 * Links the first revision created later in the same Unit-creation transaction.
 * The initial event is never externally observable before this transaction commits.
 */
export async function finalizeInitialUnitStatusRevision(
	tx: DatabaseTransaction,
	input: { readonly unitId: string; readonly revisionId: string },
): Promise<void> {
	const linked = await tx
		.update(unitStatusEvent)
		.set({ revisionId: input.revisionId })
		.where(
			and(
				eq(unitStatusEvent.unitId, input.unitId),
				isNull(unitStatusEvent.fromStatus),
				isNull(unitStatusEvent.revisionId),
			),
		)
		.returning({ id: unitStatusEvent.id });
	if (linked.length > 1)
		throw new Error(`Multiple initial Unit status events found for ${input.unitId}`);
}

export type TransitionUnitStatusResult =
	| {
			readonly changed: false;
			readonly status: UnitStatus;
			readonly publishedAt: Date | null;
	  }
	| {
			readonly changed: true;
			readonly eventId: string;
			readonly fromStatus: UnitStatus;
			readonly toStatus: UnitStatus;
			readonly publishedAt: Date | null;
	  };

/**
 * Mutates the Unit status projection and immutable ledger atomically.
 * Interactive authorization is re-evaluated against the locked state through its supplied proof.
 */
export async function transitionUnitStatus(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly toStatus: UnitStatus;
		readonly actor: UnitStatusActor;
		readonly authorization: UnitStatusTransitionAuthorization;
		readonly revisionId?: string | null;
		readonly expectedUpdatedAt?: Date;
	},
): Promise<TransitionUnitStatusResult> {
	await lockStatus(tx, input.unitId);
	const [current] = await tx
		.select({
			status: unit.status,
			publishedAt: unit.publishedAt,
			updatedAt: unit.updatedAt,
			deletedAt: unit.deletedAt,
			headRevisionId: unitRevisionHead.revisionId,
		})
		.from(unit)
		.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unit.id))
		.where(eq(unit.id, input.unitId))
		.limit(1);
	if (!current || current.deletedAt) throw new UnitNotFound();
	if (
		input.expectedUpdatedAt &&
		current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
	)
		throw new UnitChanged(current.updatedAt);
	if (current.status === input.toStatus)
		return { changed: false, status: current.status, publishedAt: current.publishedAt };
	if (
		input.authorization.kind === "interactive" &&
		crossesPublishedBoundary(current.status, input.toStatus) &&
		!input.authorization.publishAllowed
	)
		throw new UnitPermissionForbidden("unit.publish", ["unit"]);

	const revisionId = input.revisionId ?? current.headRevisionId ?? null;
	if (revisionId) {
		const [revision] = await tx
			.select({ id: unitRevision.id })
			.from(unitRevision)
			.where(and(eq(unitRevision.id, revisionId), eq(unitRevision.unitId, input.unitId)))
			.limit(1);
		if (!revision) throw new Error("Status-event revision does not belong to the Unit");
	}

	const occurredAt = new Date();
	const publishedAt = input.toStatus === "published" ? occurredAt : current.publishedAt;
	await tx
		.update(unit)
		.set({
			status: input.toStatus,
			...(input.toStatus === "published" ? { publishedAt: occurredAt } : {}),
		})
		.where(eq(unit.id, input.unitId));
	await ensureUnitVariantLifecycle(tx, input.unitId);
	const [event] = await tx
		.insert(unitStatusEvent)
		.values({
			unitId: input.unitId,
			fromStatus: current.status,
			toStatus: input.toStatus,
			...actorColumns(input.actor),
			revisionId,
			createdAt: occurredAt,
		})
		.returning({ id: unitStatusEvent.id });
	if (!event) throw new Error("Unit status transition did not return an event");
	return {
		changed: true,
		eventId: event.id,
		fromStatus: current.status,
		toStatus: input.toStatus,
		publishedAt,
	};
}

export async function getPublisherSummariesByUnitIds(
	unitIds: readonly string[],
): Promise<Map<string, UnitPublisherSummary[]>> {
	const result = new Map<string, UnitPublisherSummary[]>();
	for (const unitId of unitIds) result.set(unitId, []);
	if (!unitIds.length) return result;
	const rows = await database
		.select({
			unitId: unitStatusEvent.unitId,
			profileId: profile.id,
			name: primaryUnitTitle(profile.id),
			summary: primaryUnitSummary(profile.id),
			avatarAssetId: resolvedUnitLocalizationImageAssetId(profile.id, "avatar"),
			firstPublishedAt: min(unitStatusEvent.createdAt),
			lastPublishedAt: max(unitStatusEvent.createdAt),
			publicationCount: count(unitStatusEvent.id),
		})
		.from(unitStatusEvent)
		.innerJoin(profile, eq(profile.id, unitStatusEvent.changedByProfileId))
		.where(
			and(
				inArray(unitStatusEvent.unitId, [...unitIds]),
				eq(unitStatusEvent.toStatus, "published"),
				eq(unitStatusEvent.actorKind, "profile"),
				eq(unitStatusEvent.actorHidden, false),
			),
		)
		.groupBy(unitStatusEvent.unitId, profile.id)
		.orderBy(asc(min(unitStatusEvent.createdAt)), asc(profile.id));
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(
		rows.map((row) => row.profileId),
	);
	for (const row of rows) {
		if (!row.firstPublishedAt || !row.lastPublishedAt) continue;
		result.get(row.unitId)?.push({
			profileId: row.profileId,
			slugAddress: slugAddresses.get(row.profileId) ?? null,
			name: row.name,
			summary: row.summary,
			avatar: row.avatarAssetId
				? { id: row.avatarAssetId, url: imageAssetContentUrl(row.avatarAssetId) }
				: null,
			firstPublishedAt: row.firstPublishedAt,
			lastPublishedAt: row.lastPublishedAt,
			publicationCount: row.publicationCount,
		});
	}
	return result;
}

export async function listUnitStatusEvents(input: {
	readonly unitId: string;
	readonly cursor?: readonly [createdAt: string, id: string];
	readonly limit: number;
}): Promise<UnitStatusEventView[]> {
	const rows = await database
		.select({
			id: unitStatusEvent.id,
			unitId: unitStatusEvent.unitId,
			fromStatus: unitStatusEvent.fromStatus,
			toStatus: unitStatusEvent.toStatus,
			actorKind: unitStatusEvent.actorKind,
			actorHidden: unitStatusEvent.actorHidden,
			profileId: unitStatusEvent.changedByProfileId,
			profileName: primaryUnitTitle(profile.id),
			revisionId: unitStatusEvent.revisionId,
			createdAt: unitStatusEvent.createdAt,
		})
		.from(unitStatusEvent)
		.leftJoin(profile, eq(profile.id, unitStatusEvent.changedByProfileId))
		.where(
			and(
				eq(unitStatusEvent.unitId, input.unitId),
				input.cursor
					? or(
							lt(unitStatusEvent.createdAt, new Date(input.cursor[0])),
							and(
								eq(unitStatusEvent.createdAt, new Date(input.cursor[0])),
								lt(unitStatusEvent.id, input.cursor[1]),
							),
						)
					: undefined,
			),
		)
		.orderBy(desc(unitStatusEvent.createdAt), desc(unitStatusEvent.id))
		.limit(input.limit);
	return rows.map((row): UnitStatusEventView => {
		const actor: UnitStatusEventView["actor"] = row.actorHidden
			? { kind: "hidden" }
			: row.actorKind === "profile"
				? row.profileId
					? { kind: "profile", profileId: row.profileId, name: row.profileName }
					: { kind: "hidden" }
				: { kind: row.actorKind };
		return {
			id: row.id,
			unitId: row.unitId,
			fromStatus: row.fromStatus,
			toStatus: row.toStatus,
			actor,
			revisionId: row.revisionId,
			createdAt: row.createdAt,
		};
	});
}
