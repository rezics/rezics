import { and, desc, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { Authorization } from "../authorization";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import type { DatabaseTransaction } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { authEntity } from "@rezics/schema/postgres/access/participation";
import {
	accountFavorite,
	accountFavoriteRevision,
	accountFavoritesState,
} from "@rezics/schema/postgres/community/favorites";
import { UnitReferenceSchema } from "@rezics/reference";
import { referenceValue } from "@rezics/schema/postgres/knowledge/reference-value";
import {
	allocateReferenceValue,
	findReferenceValueByNativeId,
	referenceValueTarget,
} from "../units/reference-value";
import { readRegisteredUnitPreview, UnitReferenceUnavailable } from "../units/reference";
import { withCatalogViewerPolicy } from "../catalog/read-policy";
import { CatalogAccessDenied, CatalogReferenceNotFound } from "../catalog/storage";
import { fractionalPositionBetween } from "@rezics/schema/contracts/native/positions";
import {
	type ParticipationAuthority,
	ParticipationDenied,
	runWithParticipationAuthority,
} from "../participation/policy";
import {
	FavoritePreviewSchema,
	FavoriteSnapshotSchema,
	FavoriteListQuerySchema,
	SaveFavoriteSchema,
} from "./contracts";

import { FavoriteNotFound, FavoriteRevisionConflict } from "./errors";

async function admitFavorites(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	action: "read" | "write" = "read",
) {
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
	await ensureAccountAuthenticationAllowed(authUserId, tx);
	if (action === "write")
		await new Authorization(authority.actingEntityId, authUserId, authority).account.ensureCanWrite(
			tx,
		);
	// A selected organization never changes ownership of personal Favorites.
	return { authUserId, selfEntityId: account.selfEntityId };
}

function presentFavorite(row: typeof accountFavorite.$inferSelect, target: unknown) {
	return {
		target: UnitReferenceSchema.parse(target),
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
	targetReferenceId: string,
	afterReferenceId: string | null | undefined,
	current: typeof accountFavorite.$inferSelect | undefined,
) {
	if (afterReferenceId === targetReferenceId) throw new FavoriteRevisionConflict();
	if (afterReferenceId === undefined && current) return current.position;
	let lower: string | null = null;
	if (afterReferenceId === undefined) {
		const [last] = await tx
			.select({ position: accountFavorite.position })
			.from(accountFavorite)
			.where(eq(accountFavorite.authUserId, authUserId))
			.orderBy(desc(accountFavorite.position))
			.limit(1);
		return fractionalPositionBetween(last?.position ?? null, null);
	}
	if (afterReferenceId !== null) {
		const [anchor] = await tx
			.select({ position: accountFavorite.position })
			.from(accountFavorite)
			.where(
				and(
					eq(accountFavorite.authUserId, authUserId),
					eq(accountFavorite.targetReferenceId, afterReferenceId),
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
				ne(accountFavorite.targetReferenceId, targetReferenceId),
				lower === null ? undefined : gt(accountFavorite.position, lower),
			),
		)
		.orderBy(accountFavorite.position)
		.limit(1);
	return fractionalPositionBetween(lower, next?.position ?? null);
}

function snippet(input: string | null, maximumBytes: number) {
	if (input === null) return null;
	let result = "",
		bytes = 0;
	for (const character of input
		.replace(/\p{Cc}/gu, " ")
		.replace(/\s+/gu, " ")
		.trim()) {
		const length = Buffer.byteLength(character, "utf8");
		if (bytes + length > maximumBytes) break;
		result += character;
		bytes += length;
	}
	return result;
}
async function capturePreview(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	selfEntityId: string,
	targetUnitId: string,
) {
	const personal: ParticipationAuthority = {
		principal: authority.principal,
		actingEntityId: selfEntityId,
		authorizationRevision: authority.authorizationRevision,
	};
	try {
		return await runWithParticipationAuthority(personal, () =>
			withCatalogViewerPolicy(tx, authority.principal.authUserId, async () => {
				const target = await readRegisteredUnitPreview(tx, targetUnitId, {
					authUserId: authority.principal.authUserId,
					selfEntityId,
				});
				const preview = {
					title: snippet(target.title, 2048),
					summary: snippet(target.summary, 4096),
					language: target.language,
					capturedAt: new Date().toISOString(),
				};
				let summaryBytes = 4096;
				while (Buffer.byteLength(JSON.stringify(preview), "utf8") > 7900) {
					summaryBytes = Math.floor(summaryBytes / 2);
					preview.summary = snippet(target.summary, summaryBytes);
				}
				return { target: target.reference, preview: FavoritePreviewSchema.parse(preview) };
			}),
		);
	} catch (cause) {
		if (
			cause instanceof UnitReferenceUnavailable ||
			cause instanceof CatalogAccessDenied ||
			cause instanceof CatalogReferenceNotFound
		)
			throw new FavoriteNotFound();
		throw cause;
	}
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
		.select({ entry: accountFavorite, target: referenceValueTarget })
		.from(accountFavorite)
		.innerJoin(referenceValue, eq(referenceValue.id, accountFavorite.targetReferenceId))
		.where(
			and(
				eq(accountFavorite.authUserId, authUserId),
				value.afterPosition ? gt(accountFavorite.position, value.afterPosition) : undefined,
			),
		)
		.orderBy(accountFavorite.position)
		.limit(value.limit + 1);
	const items = rows
		.slice(0, value.limit)
		.map(({ entry, target }) => presentFavorite(entry, target));
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
	const reference = await findReferenceValueByNativeId(tx, targetUnitId);
	const [entry] = reference
		? await tx
				.select()
				.from(accountFavorite)
				.where(
					and(
						eq(accountFavorite.authUserId, authUserId),
						eq(accountFavorite.targetReferenceId, reference.valueId),
					),
				)
				.limit(1)
		: [];
	return {
		revision: state?.revision ?? 0,
		entry: entry ? presentFavorite(entry, reference?.target) : null,
	};
}

export async function saveFavorite(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	targetUnitId: string,
	input: z.input<typeof SaveFavoriteSchema>,
	restoreRevision?: number,
) {
	const { authUserId, selfEntityId } = await admitFavorites(tx, authority, "write");
	const value = SaveFavoriteSchema.parse(input);
	z.uuid().parse(targetUnitId);
	const revision = await lockFavorites(tx, authUserId, value.expectedRevision);
	const reference = await findReferenceValueByNativeId(tx, targetUnitId);
	const [current] = reference
		? await tx
				.select()
				.from(accountFavorite)
				.where(
					and(
						eq(accountFavorite.authUserId, authUserId),
						eq(accountFavorite.targetReferenceId, reference.valueId),
					),
				)
				.limit(1)
		: [];
	const restored =
		restoreRevision === undefined
			? undefined
			: await readFavoriteRevision(tx, authority, targetUnitId, restoreRevision);
	if (restored && !restored.snapshot) throw new FavoriteNotFound();
	const selected = restored?.snapshot
		? { target: restored.snapshot.target, preview: restored.snapshot.preview }
		: current && !value.refreshPreview
			? {
					target: UnitReferenceSchema.parse(reference?.target),
					preview: FavoritePreviewSchema.parse(current.snapshot),
				}
			: await capturePreview(tx, authority, selfEntityId, targetUnitId);
	const { target, preview } = selected;
	if (target.id !== targetUnitId) throw new FavoriteNotFound();
	const note = restored?.snapshot
		? restored.snapshot.note
		: value.note === undefined
			? (current?.note ?? null)
			: value.note;
	const targetReferenceId = reference?.valueId ?? (await allocateReferenceValue(tx, target));
	let afterReferenceId: string | null | undefined = value.afterTargetId;
	if (typeof value.afterTargetId === "string") {
		const anchor = await findReferenceValueByNativeId(tx, value.afterTargetId);
		if (!anchor) throw new FavoriteNotFound();
		afterReferenceId = anchor.valueId;
	}
	let position: string;
	if (restored?.snapshot && value.afterTargetId === undefined) {
		const [collision] = await tx
			.select({ id: accountFavorite.targetReferenceId })
			.from(accountFavorite)
			.where(
				and(
					eq(accountFavorite.authUserId, authUserId),
					eq(accountFavorite.position, restored.snapshot.position),
					ne(accountFavorite.targetReferenceId, targetReferenceId),
				),
			)
			.limit(1);
		position = collision
			? await favoritePosition(tx, authUserId, targetReferenceId, collision.id, current)
			: restored.snapshot.position;
	} else
		position = await favoritePosition(tx, authUserId, targetReferenceId, afterReferenceId, current);
	const now = new Date();
	const [row] = await tx
		.insert(accountFavorite)
		.values({
			authUserId,
			targetReferenceId,
			position,
			note,
			snapshot: preview,
			revision,
			createdAt: current?.createdAt ?? now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [accountFavorite.authUserId, accountFavorite.targetReferenceId],
			set: { position, note, snapshot: preview, revision, updatedAt: now },
		})
		.returning();
	if (!row) throw new Error("Favorite mutation returned no row");
	await tx.insert(accountFavoriteRevision).values({
		authUserId,
		revision,
		targetReferenceId,
		operation: restored ? "restore" : current ? "update" : "save",
		snapshot: { position, note, preview },
	});
	await tx
		.update(accountFavoritesState)
		.set({ revision })
		.where(eq(accountFavoritesState.authUserId, authUserId));
	return { revision, entry: presentFavorite(row, target) };
}

export async function deleteFavorite(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	targetUnitId: string,
	expectedRevision: number,
) {
	const { authUserId } = await admitFavorites(tx, authority, "write");
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
	const reference = await findReferenceValueByNativeId(tx, targetUnitId);
	if (!reference) throw new FavoriteNotFound();
	const [removed] = await tx
		.delete(accountFavorite)
		.where(
			and(
				eq(accountFavorite.authUserId, authUserId),
				eq(accountFavorite.targetReferenceId, reference.valueId),
			),
		)
		.returning({ targetReferenceId: accountFavorite.targetReferenceId });
	if (!removed) throw new FavoriteNotFound();
	await tx.insert(accountFavoriteRevision).values({
		authUserId,
		revision,
		targetReferenceId: removed.targetReferenceId,
		operation: "delete",
		snapshot: null,
	});
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
	const reference = await findReferenceValueByNativeId(tx, targetUnitId);
	const rows = reference
		? await tx
				.select({
					revision: accountFavoriteRevision.revision,
					operation: accountFavoriteRevision.operation,
					createdAt: accountFavoriteRevision.createdAt,
				})
				.from(accountFavoriteRevision)
				.where(
					and(
						eq(accountFavoriteRevision.authUserId, authUserId),
						eq(accountFavoriteRevision.targetReferenceId, reference.valueId),
						beforeRevision === undefined
							? undefined
							: lt(accountFavoriteRevision.revision, beforeRevision),
					),
				)
				.orderBy(desc(accountFavoriteRevision.revision))
				.limit(101)
		: [];
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
	const reference = await findReferenceValueByNativeId(tx, targetUnitId);
	if (!reference) throw new FavoriteNotFound();
	const [row] = await tx
		.select()
		.from(accountFavoriteRevision)
		.where(
			and(
				eq(accountFavoriteRevision.authUserId, authUserId),
				eq(accountFavoriteRevision.targetReferenceId, reference.valueId),
				eq(accountFavoriteRevision.revision, z.number().int().positive().safe().parse(revision)),
			),
		)
		.limit(1);
	if (!row) throw new FavoriteNotFound();
	const snapshot =
		row.snapshot === null
			? null
			: FavoriteSnapshotSchema.parse({
					...z.record(z.string(), z.unknown()).parse(row.snapshot),
					target: reference.target,
				});
	return {
		revision: row.revision,
		operation: row.operation,
		snapshot,
		createdAt: row.createdAt.toISOString(),
	};
}
