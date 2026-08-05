import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import { database, type DatabaseTransaction } from "../database";
import {
	unitAlias,
	unitReferenceCurationHead,
	unitSourceLink,
	type UnitReferenceCurationKind,
} from "../database/schema";
import {
	AliasNotFound,
	UnitReferenceCurationChanged,
	UnitSourceLinkNotFound,
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
			and(
				eq(unitReferenceCurationHead.unitId, unitId),
				eq(unitReferenceCurationHead.kind, kind),
			),
		)
		.limit(1)
		.for("update");
	if (!head) throw new Error("Reference curation head could not be initialized");
	if (head.version !== baseVersion) throw new UnitReferenceCurationChanged(head.version);
	return head;
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
		readonly candidateId: string;
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
		target: { kind: input.kind, id: input.candidateId },
		details: {
			previous: input.previous,
			resulting: input.resulting,
			curationVersion: input.version,
		},
	});
}

export async function updateUnitAliasCuration(input: {
	readonly unitId: string;
	readonly aliasId: string;
	readonly actorProfileId: string;
	readonly baseVersion: number;
	readonly state: UnitReferenceCurationState;
}) {
	return database.transaction(async (tx) => {
		const head = await lockCurationHead(tx, input.unitId, "alias", input.baseVersion);
		const [current] = await tx
			.select()
			.from(unitAlias)
			.where(and(eq(unitAlias.unitId, input.unitId), eq(unitAlias.id, input.aliasId)))
			.limit(1)
			.for("update");
		if (!current) throw new AliasNotFound();
		const previous = readUnitReferenceCurationState(current);
		if (unitReferenceCurationStatesEqual(previous, input.state))
			return { candidate: current, curationVersion: head.version };
		const [candidate] = await tx
			.update(unitAlias)
			.set({ ...input.state, updatedAt: new Date() })
			.where(and(eq(unitAlias.unitId, input.unitId), eq(unitAlias.id, input.aliasId)))
			.returning();
		if (!candidate) throw new AliasNotFound();
		const curationVersion = await advanceCurationHead(tx, {
			unitId: input.unitId,
			kind: "alias",
			currentVersion: head.version,
		});
		await recordCurationAudit(tx, {
			actorProfileId: input.actorProfileId,
			unitId: input.unitId,
			kind: "alias",
			candidateId: input.aliasId,
			previous,
			resulting: input.state,
			version: curationVersion,
		});
		return { candidate, curationVersion };
	});
}

export async function updateUnitSourceLinkCuration(input: {
	readonly unitId: string;
	readonly linkId: string;
	readonly actorProfileId: string;
	readonly baseVersion: number;
	readonly state: UnitReferenceCurationState;
}) {
	return database.transaction(async (tx) => {
		const head = await lockCurationHead(tx, input.unitId, "source_link", input.baseVersion);
		const [current] = await tx
			.select()
			.from(unitSourceLink)
			.where(
				and(eq(unitSourceLink.unitId, input.unitId), eq(unitSourceLink.id, input.linkId)),
			)
			.limit(1)
			.for("update");
		if (!current) throw new UnitSourceLinkNotFound();
		const previous = readUnitReferenceCurationState(current);
		if (unitReferenceCurationStatesEqual(previous, input.state))
			return { candidate: current, curationVersion: head.version };
		const [candidate] = await tx
			.update(unitSourceLink)
			.set({ ...input.state, updatedAt: new Date() })
			.where(
				and(eq(unitSourceLink.unitId, input.unitId), eq(unitSourceLink.id, input.linkId)),
			)
			.returning();
		if (!candidate) throw new UnitSourceLinkNotFound();
		const curationVersion = await advanceCurationHead(tx, {
			unitId: input.unitId,
			kind: "source_link",
			currentVersion: head.version,
		});
		await recordCurationAudit(tx, {
			actorProfileId: input.actorProfileId,
			unitId: input.unitId,
			kind: "source_link",
			candidateId: input.linkId,
			previous,
			resulting: input.state,
			version: curationVersion,
		});
		return { candidate, curationVersion };
	});
}
