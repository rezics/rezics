import { and, desc, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import { authEntity } from "../database/schema/participation";
import {
	accountFavorite,
	accountFavoriteRevision,
	accountFavoritesState,
} from "../database/schema/favorites";
import { unit, unitLocalization } from "../database/schema/unit";
import { getUnitReadCondition } from "../authorization/unit/query";
import { fractionalPositionBetween } from "../ordering/position";
import { type ParticipationAuthority, ParticipationDenied } from "../participation/policy";
import {
	FavoritePreviewSchema,
	FavoriteSnapshotSchema,
	FavoriteListQuerySchema,
	SaveFavoriteSchema,
} from "./contracts";

import { FavoriteNotFound, FavoriteRevisionConflict } from "./errors";

async function admitFavorites(tx: DatabaseTransaction, authority: ParticipationAuthority) {
	if (authority.principal.kind !== "auth")
		throw new ParticipationDenied("Favorites require a human account");
	const authUserId = authority.principal.authUserId;
	const [account] = await tx
		.select({ id: users.id, selfEntityId: authEntity.entityId })
		.from(users)
		.innerJoin(authEntity, eq(authEntity.authUserId, users.id))
		.where(
			and(
				eq(users.id, authUserId),
				eq(users.principalKind, "human"),
				isNull(users.erasedAt),
				eq(authEntity.state, "active"),
				eq(authEntity.revision, authority.authorizationRevision),
			),
		)
		.limit(1)
		.for("share");
	if (!account) throw new ParticipationDenied("Account is unavailable");
	// A selected organization never changes ownership of personal Favorites.
	return { authUserId, selfEntityId: account.selfEntityId };
}

function presentFavorite(row: typeof accountFavorite.$inferSelect) {
	return {
		targetUnitId: row.targetUnitId,
		position: row.position,
		note: row.note,
		preview: FavoritePreviewSchema.parse(row.snapshot),
		revision: row.revision,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

async function lockFavorites(
	tx: DatabaseTransaction,
	authUserId: string,
	expectedRevision: number,
) {
	await tx.insert(accountFavoritesState).values({ authUserId }).onConflictDoNothing();
	const [state] = await tx
		.select()
		.from(accountFavoritesState)
		.where(eq(accountFavoritesState.authUserId, authUserId))
		.limit(1)
		.for("update");
	if (!state || state.revision !== expectedRevision) throw new FavoriteRevisionConflict();
	return state.revision + 1;
}

async function favoritePosition(
	tx: DatabaseTransaction,
	authUserId: string,
	targetUnitId: string,
	afterTargetId: string | null | undefined,
	current: typeof accountFavorite.$inferSelect | undefined,
) {
	if (afterTargetId === targetUnitId) throw new FavoriteRevisionConflict();
	if (afterTargetId === undefined && current) return current.position;
	let lower: string | null = null;
	if (afterTargetId === undefined) {
		const [last] = await tx
			.select({ position: accountFavorite.position })
			.from(accountFavorite)
			.where(eq(accountFavorite.authUserId, authUserId))
			.orderBy(desc(accountFavorite.position))
			.limit(1);
		return fractionalPositionBetween(last?.position ?? null, null);
	}
	if (afterTargetId !== null) {
		const [anchor] = await tx
			.select({ position: accountFavorite.position })
			.from(accountFavorite)
			.where(
				and(
					eq(accountFavorite.authUserId, authUserId),
					eq(accountFavorite.targetUnitId, afterTargetId),
				),
			)
			.limit(1);
		if (!anchor) throw new FavoriteNotFound();
		lower = anchor.position;
	}
	const [next] = await tx
		.select({ position: accountFavorite.position })
		.from(accountFavorite)
		.where(
			and(
				eq(accountFavorite.authUserId, authUserId),
				ne(accountFavorite.targetUnitId, targetUnitId),
				lower === null ? undefined : gt(accountFavorite.position, lower),
			),
		)
		.orderBy(accountFavorite.position)
		.limit(1);
	return fractionalPositionBetween(lower, next?.position ?? null);
}

async function capturePreview(tx: DatabaseTransaction, selfEntityId: string, targetUnitId: string) {
	const [target] = await tx
		.select({ id: unit.id, kind: unit.kind })
		.from(unit)
		.where(and(eq(unit.id, targetUnitId), getUnitReadCondition(selfEntityId)))
		.limit(1)
		.for("share");
	if (!target) throw new FavoriteNotFound();
	const [localization] = await tx
		.select({
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			language: unitLocalization.language,
		})
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, targetUnitId))
		.orderBy(unitLocalization.position, unitLocalization.language)
		.limit(1);
	return FavoritePreviewSchema.parse({
		kind: target.kind,
		title: localization?.title ?? null,
		summary: localization?.summary ?? null,
		language: localization?.language ?? null,
		capturedAt: new Date().toISOString(),
	});
}

export async function listFavorites(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: z.input<typeof FavoriteListQuerySchema>,
) {
	const { authUserId } = await admitFavorites(tx, authority);
	const value = FavoriteListQuerySchema.parse(input);
	await tx.insert(accountFavoritesState).values({ authUserId }).onConflictDoNothing();
	const [state] = await tx
		.select({ revision: accountFavoritesState.revision })
		.from(accountFavoritesState)
		.where(eq(accountFavoritesState.authUserId, authUserId))
		.limit(1)
		.for("share");
	const rows = await tx
		.select()
		.from(accountFavorite)
		.where(
			and(
				eq(accountFavorite.authUserId, authUserId),
				value.afterPosition ? gt(accountFavorite.position, value.afterPosition) : undefined,
			),
		)
		.orderBy(accountFavorite.position)
		.limit(value.limit + 1);
	const items = rows.slice(0, value.limit).map(presentFavorite);
	return {
		revision: state?.revision ?? 0,
		items,
		nextCursor: rows.length > value.limit ? (items.at(-1)?.position ?? null) : null,
	};
}

/** Read one private entry and the account revision from the same serialized snapshot. */
export async function readFavorite(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	targetUnitId: string,
) {
	const { authUserId } = await admitFavorites(tx, authority);
	z.uuid().parse(targetUnitId);
	await tx.insert(accountFavoritesState).values({ authUserId }).onConflictDoNothing();
	const [state] = await tx
		.select({ revision: accountFavoritesState.revision })
		.from(accountFavoritesState)
		.where(eq(accountFavoritesState.authUserId, authUserId))
		.limit(1)
		.for("share");
	const [entry] = await tx
		.select()
		.from(accountFavorite)
		.where(
			and(
				eq(accountFavorite.authUserId, authUserId),
				eq(accountFavorite.targetUnitId, targetUnitId),
			),
		)
		.limit(1);
	return { revision: state?.revision ?? 0, entry: entry ? presentFavorite(entry) : null };
}

export async function saveFavorite(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	targetUnitId: string,
	input: z.input<typeof SaveFavoriteSchema>,
	restoreRevision?: number,
) {
	const { authUserId, selfEntityId } = await admitFavorites(tx, authority);
	const value = SaveFavoriteSchema.parse(input);
	z.uuid().parse(targetUnitId);
	const revision = await lockFavorites(tx, authUserId, value.expectedRevision);
	const [current] = await tx
		.select()
		.from(accountFavorite)
		.where(
			and(
				eq(accountFavorite.authUserId, authUserId),
				eq(accountFavorite.targetUnitId, targetUnitId),
			),
		)
		.limit(1);
	const restored =
		restoreRevision === undefined
			? undefined
			: await readFavoriteRevision(tx, authority, targetUnitId, restoreRevision);
	if (restored && !restored.snapshot) throw new FavoriteNotFound();
	const preview =
		restored?.snapshot?.preview ??
		(current && !value.refreshPreview
			? FavoritePreviewSchema.parse(current.snapshot)
			: await capturePreview(tx, selfEntityId, targetUnitId));
	const note = restored?.snapshot
		? restored.snapshot.note
		: value.note === undefined
			? (current?.note ?? null)
			: value.note;
	let position: string;
	if (restored?.snapshot && value.afterTargetId === undefined) {
		const [collision] = await tx
			.select({ id: accountFavorite.targetUnitId })
			.from(accountFavorite)
			.where(
				and(
					eq(accountFavorite.authUserId, authUserId),
					eq(accountFavorite.position, restored.snapshot.position),
					ne(accountFavorite.targetUnitId, targetUnitId),
				),
			)
			.limit(1);
		position = collision
			? await favoritePosition(tx, authUserId, targetUnitId, collision.id, current)
			: restored.snapshot.position;
	} else
		position = await favoritePosition(tx, authUserId, targetUnitId, value.afterTargetId, current);
	const now = new Date();
	const [row] = await tx
		.insert(accountFavorite)
		.values({
			authUserId,
			targetUnitId,
			position,
			note,
			snapshot: preview,
			revision,
			createdAt: current?.createdAt ?? now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [accountFavorite.authUserId, accountFavorite.targetUnitId],
			set: { position, note, snapshot: preview, revision, updatedAt: now },
		})
		.returning();
	if (!row) throw new Error("Favorite mutation returned no row");
	await tx.insert(accountFavoriteRevision).values({
		authUserId,
		revision,
		targetUnitId,
		operation: restored ? "restore" : current ? "update" : "save",
		snapshot: { targetUnitId, position, note, preview },
	});
	await tx
		.update(accountFavoritesState)
		.set({ revision })
		.where(eq(accountFavoritesState.authUserId, authUserId));
	return { revision, entry: presentFavorite(row) };
}

export async function deleteFavorite(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	targetUnitId: string,
	expectedRevision: number,
) {
	const { authUserId } = await admitFavorites(tx, authority);
	const revision = await lockFavorites(
		tx,
		authUserId,
		z
			.number()
			.int()
			.nonnegative()
			.max(Number.MAX_SAFE_INTEGER - 1)
			.parse(expectedRevision),
	);
	const removed = await tx
		.delete(accountFavorite)
		.where(
			and(
				eq(accountFavorite.authUserId, authUserId),
				eq(accountFavorite.targetUnitId, z.uuid().parse(targetUnitId)),
			),
		)
		.returning({ id: accountFavorite.targetUnitId });
	if (!removed.length) throw new FavoriteNotFound();
	await tx
		.insert(accountFavoriteRevision)
		.values({ authUserId, revision, targetUnitId, operation: "delete", snapshot: null });
	await tx
		.update(accountFavoritesState)
		.set({ revision })
		.where(eq(accountFavoritesState.authUserId, authUserId));
	return { revision, entry: null };
}

export async function listFavoriteHistory(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	targetUnitId: string,
	beforeRevision?: number,
) {
	const { authUserId } = await admitFavorites(tx, authority);
	const rows = await tx
		.select({
			revision: accountFavoriteRevision.revision,
			operation: accountFavoriteRevision.operation,
			createdAt: accountFavoriteRevision.createdAt,
		})
		.from(accountFavoriteRevision)
		.where(
			and(
				eq(accountFavoriteRevision.authUserId, authUserId),
				eq(accountFavoriteRevision.targetUnitId, z.uuid().parse(targetUnitId)),
				beforeRevision === undefined
					? undefined
					: lt(accountFavoriteRevision.revision, beforeRevision),
			),
		)
		.orderBy(desc(accountFavoriteRevision.revision))
		.limit(101);
	const items = rows
		.slice(0, 100)
		.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
	return { items, nextCursor: rows.length > 100 ? (items.at(-1)?.revision ?? null) : null };
}

export async function readFavoriteRevision(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	targetUnitId: string,
	revision: number,
) {
	const { authUserId } = await admitFavorites(tx, authority);
	const [row] = await tx
		.select()
		.from(accountFavoriteRevision)
		.where(
			and(
				eq(accountFavoriteRevision.authUserId, authUserId),
				eq(accountFavoriteRevision.targetUnitId, z.uuid().parse(targetUnitId)),
				eq(accountFavoriteRevision.revision, z.number().int().positive().safe().parse(revision)),
			),
		)
		.limit(1);
	if (!row) throw new FavoriteNotFound();
	const snapshot = row.snapshot === null ? null : FavoriteSnapshotSchema.parse(row.snapshot);
	if (snapshot && snapshot.targetUnitId !== targetUnitId)
		throw new Error("Favorite snapshot target disagrees with its history key");
	return {
		revision: row.revision,
		operation: row.operation,
		snapshot,
		createdAt: row.createdAt.toISOString(),
	};
}
