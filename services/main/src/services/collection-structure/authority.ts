import { and, eq, isNull } from "drizzle-orm";
import type { Authorization } from "../authorization";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import { EmailVerificationRequired } from "../auth/errors";
import { lockUnitAccessState } from "../authorization/unit/access-lock";
import { database, type DatabaseTransaction } from "../database";
import { users, authEntity } from "../database/schema";
import { ParticipationDenied } from "../participation/policy";
import { CollectionNotFound } from "../api/collections/errors";
import { readUnitStateById } from "../units/query";
import { type UnitStatus, lockUnitStatusTransition } from "../units/status";

/** Existing API capability policy for inspecting curation history. @internal */
export const CollectionHistoryPermissions = [
	"unit.update",
	"unit.access.manage",
	"unit.history.restore",
] as const;

type Mode = "history" | "items" | "metadata" | "restore";
async function admitActor(tx: DatabaseTransaction, authorization: Authorization, write: boolean) {
	const { authUserId, profileId, participationAuthority: authority } = authorization;
	if (
		!authUserId ||
		!profileId ||
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.principal.authUserId !== authUserId
	)
		throw new ParticipationDenied("Current account authority is required");
	const [account] = await tx
		.select({ emailVerified: users.emailVerified })
		.from(users)
		.where(and(eq(users.id, authUserId), eq(users.principalKind, "human"), isNull(users.erasedAt)))
		.limit(1)
		.for("share");
	if (!account) throw new ParticipationDenied("Account is unavailable");
	await ensureAccountAuthenticationAllowed(authUserId, tx);
	if (write) {
		if (!account.emailVerified) throw new EmailVerificationRequired();
		await authorization.account.ensureCanWrite(tx);
	}
	const [self] = await tx
		.select({ id: authEntity.entityId })
		.from(authEntity)
		.where(
			and(
				eq(authEntity.authUserId, authUserId),
				eq(authEntity.entityId, profileId),
				eq(authEntity.state, "active"),
				eq(authEntity.revision, authority.authorizationRevision),
			),
		)
		.limit(1)
		.for("share");
	if (!self) throw new ParticipationDenied("Account Self identity changed");
}
async function ensureScope(
	tx: DatabaseTransaction,
	authorization: Authorization,
	collectionId: string,
	mode: Mode,
) {
	if (mode !== "history")
		return authorization.unit.ensureInTransaction(
			tx,
			collectionId,
			mode === "restore" ? "unit.history.restore" : "unit.update",
		);
	if (!(await authorization.unit.decideInTransaction(tx, collectionId, "unit.read")).allowed)
		throw new CollectionNotFound();
	for (const permission of CollectionHistoryPermissions)
		if ((await authorization.unit.decideInTransaction(tx, collectionId, permission)).allowed)
			return;
	throw new ParticipationDenied("Collection history is unavailable to this account");
}
/** Keep current account and curation authority through the Collection transaction and all waits. @internal */
export async function withCollectionAuthority<T>(
	input: {
		readonly collectionId: string;
		readonly authorization: Authorization;
		readonly mode: Mode;
		readonly status?: UnitStatus;
	},
	work: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
	return database.transaction(async (tx) => {
		await admitActor(tx, input.authorization, input.mode !== "history");
		await lockUnitAccessState(
			tx,
			[input.collectionId],
			input.mode === "metadata" ? "exclusive" : "shared",
		);
		// Status transitions take this lock before the native row; preserve that order during metadata edits.
		if (input.mode === "metadata") await lockUnitStatusTransition(tx, input.collectionId);
		const parent = await readUnitStateById(tx, input.collectionId, {
			lock: input.mode === "history" ? "share" : "no key update",
		});
		if (!parent || parent.reference.owner !== "collection") throw new CollectionNotFound();
		await ensureScope(tx, input.authorization, input.collectionId, input.mode);
		const changesStatus =
			input.mode === "metadata" && input.status !== undefined && input.status !== parent.status;
		if (changesStatus)
			await input.authorization.unit.ensureInTransaction(
				tx,
				input.collectionId,
				"unit.status.update",
				["unit"],
			);
		const result = await work(tx);
		await ensureScope(tx, input.authorization, input.collectionId, input.mode);
		if (changesStatus)
			await input.authorization.unit.ensureInTransaction(
				tx,
				input.collectionId,
				"unit.status.update",
				["unit"],
			);
		if (input.mode !== "history") await input.authorization.account.ensureCanWrite(tx);
		return result;
	});
}
/** Admit creation before it has a parent resource, with the same current account gates. @internal */
export async function withCollectionCreationAuthority<T>(
	authorization: Authorization,
	work: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
	return database.transaction(async (tx) => {
		await admitActor(tx, authorization, true);
		const result = await work(tx);
		await authorization.account.ensureCanWrite(tx);
		return result;
	});
}
