import { and, eq, isNull, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import { database, type DatabaseTransaction } from "../database";
import {
	unitAlias,
	unitReferenceCurationHead,
	unitExternalLink,
	type UnitReferenceCurationKind,
	UnitReferenceActiveLimit,
	UnitReferencePinnedLimit,
} from "../database/schema";
import {
	AliasNotFound,
	UnitReferenceCurationChanged,
	UnitExternalLinkNotFound,
	UnitReferenceLimitReached,
	UnitReferencePinnedLimitReached,
} from "../api/unit-resources/errors";

export type UnitReferenceCurationState =
	| { readonly pinned: true; readonly position: string }
	| { readonly pinned: false; readonly position: null };

/** @internal Reads the database-enforced pin/position state as a discriminated union. */
export function readUnitReferenceCurationState(input: {
	readonly pinned: boolean;
	readonly position: string | null;
}): UnitReferenceCurationState {
	if (input.pinned) {
		if (input.position === null) throw new Error("Pinned reference is missing its position");
		return { pinned: true, position: input.position };
	}
	if (input.position !== null) throw new Error("Unpinned reference unexpectedly has a position");
	return { pinned: false, position: null };
}

/** @internal Compares the complete persisted curation state. */
export function unitReferenceCurationStatesEqual(
	current: UnitReferenceCurationState,
	requested: UnitReferenceCurationState,
): boolean {
	return current.pinned === requested.pinned && current.position === requested.position;
}

async function lockCurationHead(
	tx: DatabaseTransaction,
	unitId: string,
	kind: UnitReferenceCurationKind,
	baseVersion: number,
) {
	await tx.insert(unitReferenceCurationHead).values({ unitId, kind }).onConflictDoNothing();
	const [head] = await tx
		.select()
		.from(unitReferenceCurationHead)
		.where(
			and(eq(unitReferenceCurationHead.unitId, unitId), eq(unitReferenceCurationHead.kind, kind)),
		)
		.limit(1)
		.for("update");
	if (!head) throw new Error("Reference curation head could not be initialized");
	if (head.version !== baseVersion) throw new UnitReferenceCurationChanged(head.version);
	return head;
}

/** Uses the same key as the database trigger for every collection mutation. */
async function lockUnitReferenceCollection(
	tx: DatabaseTransaction,
	input: { readonly unitId: string; readonly kind: UnitReferenceCurationKind },
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-reference:${input.kind}:${input.unitId}`}, 0))`,
	);
}

async function advanceCurationHead(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly kind: UnitReferenceCurationKind;
		readonly currentVersion: number;
	},
) {
	const version = input.currentVersion + 1;
	await tx
		.update(unitReferenceCurationHead)
		.set({ version, updatedAt: new Date() })
		.where(
			and(
				eq(unitReferenceCurationHead.unitId, input.unitId),
				eq(unitReferenceCurationHead.kind, input.kind),
			),
		);
	return version;
}

async function recordCurationAudit(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly unitId: string;
		readonly kind: UnitReferenceCurationKind;
		readonly referenceId: string;
		readonly previous: UnitReferenceCurationState;
		readonly resulting: UnitReferenceCurationState;
		readonly version: number;
	},
) {
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.unitId },
		action: "unit.reference-curation.update",
		target: { kind: input.kind, id: input.referenceId },
		details: {
			previous: input.previous,
			resulting: input.resulting,
			curationVersion: input.version,
		},
	});
}

/** Serializes creation for one bounded Unit reference collection. */
export async function ensureUnitReferenceCanBeCreated(
	tx: DatabaseTransaction,
	input: { readonly unitId: string; readonly kind: UnitReferenceCurationKind },
): Promise<void> {
	await lockUnitReferenceCollection(tx, input);
	const active =
		input.kind === "alias"
			? await tx
					.select({ id: unitAlias.id })
					.from(unitAlias)
					.where(and(eq(unitAlias.unitId, input.unitId), isNull(unitAlias.withdrawnAt)))
					.limit(UnitReferenceActiveLimit)
			: await tx
					.select({ id: unitExternalLink.id })
					.from(unitExternalLink)
					.where(
						and(eq(unitExternalLink.unitId, input.unitId), isNull(unitExternalLink.withdrawnAt)),
					)
					.limit(UnitReferenceActiveLimit);
	if (active.length >= UnitReferenceActiveLimit)
		throw new UnitReferenceLimitReached(UnitReferenceActiveLimit);
}

async function ensurePinnedReferenceCapacity(
	tx: DatabaseTransaction,
	input: { readonly unitId: string; readonly kind: UnitReferenceCurationKind },
): Promise<void> {
	const pinned =
		input.kind === "alias"
			? await tx
					.select({ id: unitAlias.id })
					.from(unitAlias)
					.where(
						and(
							eq(unitAlias.unitId, input.unitId),
							eq(unitAlias.pinned, true),
							isNull(unitAlias.withdrawnAt),
						),
					)
					.limit(UnitReferencePinnedLimit)
			: await tx
					.select({ id: unitExternalLink.id })
					.from(unitExternalLink)
					.where(
						and(
							eq(unitExternalLink.unitId, input.unitId),
							eq(unitExternalLink.pinned, true),
							isNull(unitExternalLink.withdrawnAt),
						),
					)
					.limit(UnitReferencePinnedLimit);
	if (pinned.length >= UnitReferencePinnedLimit)
		throw new UnitReferencePinnedLimitReached(UnitReferencePinnedLimit);
}

export async function updateUnitAliasCuration(input: {
	readonly unitId: string;
	readonly aliasId: string;
	readonly actorProfileId: string;
	readonly baseVersion: number;
	readonly state: UnitReferenceCurationState;
}) {
	return database.transaction(async (tx) => {
		await lockUnitReferenceCollection(tx, { unitId: input.unitId, kind: "alias" });
		const head = await lockCurationHead(tx, input.unitId, "alias", input.baseVersion);
		const [current] = await tx
			.select()
			.from(unitAlias)
			.where(
				and(
					eq(unitAlias.unitId, input.unitId),
					eq(unitAlias.id, input.aliasId),
					isNull(unitAlias.withdrawnAt),
				),
			)
			.limit(1)
			.for("update");
		if (!current) throw new AliasNotFound();
		const previous = readUnitReferenceCurationState(current);
		if (unitReferenceCurationStatesEqual(previous, input.state))
			return { reference: current, curationVersion: head.version };
		if (input.state.pinned && !previous.pinned)
			await ensurePinnedReferenceCapacity(tx, { unitId: input.unitId, kind: "alias" });
		const [reference] = await tx
			.update(unitAlias)
			.set({ ...input.state, updatedAt: new Date() })
			.where(and(eq(unitAlias.unitId, input.unitId), eq(unitAlias.id, input.aliasId)))
			.returning();
		if (!reference) throw new AliasNotFound();
		const curationVersion = await advanceCurationHead(tx, {
			unitId: input.unitId,
			kind: "alias",
			currentVersion: head.version,
		});
		await recordCurationAudit(tx, {
			actorProfileId: input.actorProfileId,
			unitId: input.unitId,
			kind: "alias",
			referenceId: input.aliasId,
			previous,
			resulting: input.state,
			version: curationVersion,
		});
		return { reference, curationVersion };
	});
}

export async function updateUnitExternalLinkCuration(input: {
	readonly unitId: string;
	readonly externalLinkId: string;
	readonly actorProfileId: string;
	readonly baseVersion: number;
	readonly state: UnitReferenceCurationState;
}) {
	return database.transaction(async (tx) => {
		await lockUnitReferenceCollection(tx, {
			unitId: input.unitId,
			kind: "external_link",
		});
		const head = await lockCurationHead(tx, input.unitId, "external_link", input.baseVersion);
		const [current] = await tx
			.select()
			.from(unitExternalLink)
			.where(
				and(
					eq(unitExternalLink.unitId, input.unitId),
					eq(unitExternalLink.id, input.externalLinkId),
					isNull(unitExternalLink.withdrawnAt),
				),
			)
			.limit(1)
			.for("update");
		if (!current) throw new UnitExternalLinkNotFound();
		const previous = readUnitReferenceCurationState(current);
		if (unitReferenceCurationStatesEqual(previous, input.state))
			return { reference: current, curationVersion: head.version };
		if (input.state.pinned && !previous.pinned)
			await ensurePinnedReferenceCapacity(tx, {
				unitId: input.unitId,
				kind: "external_link",
			});
		const [reference] = await tx
			.update(unitExternalLink)
			.set({ ...input.state, updatedAt: new Date() })
			.where(
				and(
					eq(unitExternalLink.unitId, input.unitId),
					eq(unitExternalLink.id, input.externalLinkId),
				),
			)
			.returning();
		if (!reference) throw new UnitExternalLinkNotFound();
		const curationVersion = await advanceCurationHead(tx, {
			unitId: input.unitId,
			kind: "external_link",
			currentVersion: head.version,
		});
		await recordCurationAudit(tx, {
			actorProfileId: input.actorProfileId,
			unitId: input.unitId,
			kind: "external_link",
			referenceId: input.externalLinkId,
			previous,
			resulting: input.state,
			version: curationVersion,
		});
		return { reference, curationVersion };
	});
}

async function recordWithdrawalAudit(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly unitId: string;
		readonly kind: UnitReferenceCurationKind;
		readonly referenceId: string;
		readonly previous: UnitReferenceCurationState;
		readonly version: number;
	},
) {
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.unitId },
		action: "unit.reference.withdraw",
		target: { kind: input.kind, id: input.referenceId },
		details: { previous: input.previous, curationVersion: input.version },
	});
}

export async function withdrawUnitAlias(input: {
	readonly unitId: string;
	readonly aliasId: string;
	readonly actorProfileId: string;
	readonly baseVersion: number;
}): Promise<void> {
	await database.transaction(async (tx) => {
		await lockUnitReferenceCollection(tx, { unitId: input.unitId, kind: "alias" });
		const head = await lockCurationHead(tx, input.unitId, "alias", input.baseVersion);
		const [current] = await tx
			.select()
			.from(unitAlias)
			.where(
				and(
					eq(unitAlias.unitId, input.unitId),
					eq(unitAlias.id, input.aliasId),
					isNull(unitAlias.withdrawnAt),
				),
			)
			.limit(1)
			.for("update");
		if (!current) throw new AliasNotFound();
		await tx
			.update(unitAlias)
			.set({ withdrawnAt: new Date(), pinned: false, position: null, updatedAt: new Date() })
			.where(and(eq(unitAlias.unitId, input.unitId), eq(unitAlias.id, input.aliasId)));
		const curationVersion = await advanceCurationHead(tx, {
			unitId: input.unitId,
			kind: "alias",
			currentVersion: head.version,
		});
		await recordWithdrawalAudit(tx, {
			actorProfileId: input.actorProfileId,
			unitId: input.unitId,
			kind: "alias",
			referenceId: input.aliasId,
			previous: readUnitReferenceCurationState(current),
			version: curationVersion,
		});
	});
}

export async function withdrawUnitExternalLink(input: {
	readonly unitId: string;
	readonly externalLinkId: string;
	readonly actorProfileId: string;
	readonly baseVersion: number;
}): Promise<void> {
	await database.transaction(async (tx) => {
		await lockUnitReferenceCollection(tx, {
			unitId: input.unitId,
			kind: "external_link",
		});
		const head = await lockCurationHead(tx, input.unitId, "external_link", input.baseVersion);
		const [current] = await tx
			.select()
			.from(unitExternalLink)
			.where(
				and(
					eq(unitExternalLink.unitId, input.unitId),
					eq(unitExternalLink.id, input.externalLinkId),
					isNull(unitExternalLink.withdrawnAt),
				),
			)
			.limit(1)
			.for("update");
		if (!current) throw new UnitExternalLinkNotFound();
		await tx
			.update(unitExternalLink)
			.set({ withdrawnAt: new Date(), pinned: false, position: null, updatedAt: new Date() })
			.where(
				and(
					eq(unitExternalLink.unitId, input.unitId),
					eq(unitExternalLink.id, input.externalLinkId),
				),
			);
		const curationVersion = await advanceCurationHead(tx, {
			unitId: input.unitId,
			kind: "external_link",
			currentVersion: head.version,
		});
		await recordWithdrawalAudit(tx, {
			actorProfileId: input.actorProfileId,
			unitId: input.unitId,
			kind: "external_link",
			referenceId: input.externalLinkId,
			previous: readUnitReferenceCurationState(current),
			version: curationVersion,
		});
	});
}
