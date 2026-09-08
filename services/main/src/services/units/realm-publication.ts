import { z } from "zod";
import type { LocalizationLanguageQuery } from "./localization";
import { readUnitPresentationsInTransaction } from "./presentation-reader";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import type { Authorization } from "../authorization";
import { database, type DatabaseTransaction } from "../database";
import { contentGovernanceAction, realmUnit, realmUnitPublicationEvent } from "../database/schema";
import {
	UnitRealmPublicationAlreadyExists,
	UnitRealmPublicationNotFound,
	UnitRealmPublicationTransitionInvalid,
} from "./errors";

export type UnitRealmPublicationState = "active" | "withdrawn";
export type UnitRealmPublicationStateFilter = UnitRealmPublicationState | "all";
export type UnitRealmPublicationStatusFilter =
	| "current"
	| "all"
	| "pending"
	| "visible"
	| "hidden"
	| "removed";

type PublicationCursor = readonly [Date, string];
type RealmUnitPublicationEventInsert = typeof realmUnitPublicationEvent.$inferInsert;

export const unitRealmPublicationAdvisoryLock = (realmId: string, unitId: string) =>
	sql`select pg_advisory_xact_lock(hashtextextended(${`unit-realm-publication:${unitId}:${realmId}`}::text, 0))`;

async function ensureUnitRealmPublicationManagement(
	tx: DatabaseTransaction,
	unitId: string,
	authorization: Authorization<string>,
): Promise<void> {
	await authorization.unit.ensureInTransaction(tx, unitId, "unit.realm-publication.manage");
}

async function recordPublicationTransition(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly realmId: string;
		readonly fromState: UnitRealmPublicationState | null;
		readonly toState: UnitRealmPublicationState;
		readonly actorProfileId: string;
	},
): Promise<void> {
	await tx.insert(realmUnitPublicationEvent).values({
		unitId: input.unitId,
		realmId: input.realmId,
		fromState: input.fromState,
		toState: input.toState,
		changedByProfileId: input.actorProfileId,
	});
}

export async function recordInitialRealmUnitPublicationEvents(
	tx: DatabaseTransaction,
	input: {
		readonly relations: readonly {
			readonly realmId: string;
			readonly unitId: string;
			readonly createdAt?: Date;
		}[];
		readonly actorProfileId?: string;
	},
): Promise<void> {
	if (!input.relations.length) return;
	await tx.insert(realmUnitPublicationEvent).values(
		input.relations.map<RealmUnitPublicationEventInsert>((relation) => ({
			realmId: relation.realmId,
			unitId: relation.unitId,
			fromState: null,
			toState: "active",
			changedByProfileId: input.actorProfileId,
			...(relation.createdAt ? { createdAt: relation.createdAt } : {}),
		})),
	);
}

export async function createUnitRealmPublication(input: {
	readonly unitId: string;
	readonly realmId: string;
	readonly authorization: Authorization<string>;
}): Promise<void> {
	await database.transaction(async (tx) => {
		await tx.execute(unitRealmPublicationAdvisoryLock(input.realmId, input.unitId));
		await ensureUnitRealmPublicationManagement(tx, input.unitId, input.authorization);
		await input.authorization.realm.ensureUnitCreationInTransaction(
			tx,
			[input.realmId],
			"realm.units.create",
		);
		const [existing] = await tx
			.select({ unitId: realmUnit.unitId })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, input.realmId), eq(realmUnit.unitId, input.unitId)))
			.limit(1);
		if (existing) throw new UnitRealmPublicationAlreadyExists();
		await tx.insert(realmUnit).values({
			realmId: input.realmId,
			unitId: input.unitId,
			publicationState: "active",
		});
		await recordPublicationTransition(tx, {
			realmId: input.realmId,
			unitId: input.unitId,
			fromState: null,
			toState: "active",
			actorProfileId: input.authorization.profileId,
		});
	});
}

async function transitionUnitRealmPublication(input: {
	readonly unitId: string;
	readonly realmId: string;
	readonly toState: UnitRealmPublicationState;
	readonly authorization: Authorization<string>;
}): Promise<void> {
	await database.transaction(async (tx) => {
		await tx.execute(unitRealmPublicationAdvisoryLock(input.realmId, input.unitId));
		await ensureUnitRealmPublicationManagement(tx, input.unitId, input.authorization);
		if (input.toState === "active")
			await input.authorization.realm.ensureUnitCreationInTransaction(
				tx,
				[input.realmId],
				"realm.units.create",
			);
		const [current] = await tx
			.select({ publicationState: realmUnit.publicationState })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, input.realmId), eq(realmUnit.unitId, input.unitId)))
			.limit(1);
		if (!current) throw new UnitRealmPublicationNotFound();
		if (current.publicationState === input.toState)
			throw new UnitRealmPublicationTransitionInvalid(current.publicationState);
		const [updated] = await tx
			.update(realmUnit)
			.set({ publicationState: input.toState, updatedAt: new Date() })
			.where(
				and(
					eq(realmUnit.realmId, input.realmId),
					eq(realmUnit.unitId, input.unitId),
					eq(realmUnit.publicationState, current.publicationState),
				),
			)
			.returning({ publicationState: realmUnit.publicationState });
		if (!updated) throw new UnitRealmPublicationTransitionInvalid(current.publicationState);
		await recordPublicationTransition(tx, {
			realmId: input.realmId,
			unitId: input.unitId,
			fromState: current.publicationState,
			toState: input.toState,
			actorProfileId: input.authorization.profileId,
		});
	});
}

export function withdrawUnitRealmPublication(
	input: Omit<Parameters<typeof transitionUnitRealmPublication>[0], "toState">,
): Promise<void> {
	return transitionUnitRealmPublication({ ...input, toState: "withdrawn" });
}

export function republishUnitRealmPublication(
	input: Omit<Parameters<typeof transitionUnitRealmPublication>[0], "toState">,
): Promise<void> {
	return transitionUnitRealmPublication({ ...input, toState: "active" });
}

export async function listUnitRealmPublications(input: {
	readonly unitId: string;
	readonly authorization: Authorization<string>;
	readonly localizationLanguages: LocalizationLanguageQuery;
	readonly publicationState: UnitRealmPublicationStateFilter;
	readonly status: UnitRealmPublicationStatusFilter;
	readonly cursor?: PublicationCursor;
	readonly limit: number;
}) {
	const limit = z.number().int().min(1).max(100).parse(input.limit),
		window = Math.min(500, limit * 5);
	return database.transaction(
		async (tx) => {
			await input.authorization.unit.ensureInTransaction(
				tx,
				input.unitId,
				"unit.realm-publication.manage",
			);
			const candidates = await tx
				.select({
					realmId: realmUnit.realmId,
					publicationState: realmUnit.publicationState,
					status: realmUnit.status,
					createdAt: realmUnit.createdAt,
					updatedAt: realmUnit.updatedAt,
					latestGovernanceActionId: realmUnit.latestGovernanceActionId,
				})
				.from(realmUnit)
				.where(
					and(
						eq(realmUnit.unitId, input.unitId),
						input.cursor
							? or(
									lt(realmUnit.updatedAt, input.cursor[0]),
									and(
										eq(realmUnit.updatedAt, input.cursor[0]),
										lt(realmUnit.realmId, input.cursor[1]),
									),
								)
							: undefined,
					),
				)
				.orderBy(desc(realmUnit.updatedAt), desc(realmUnit.realmId))
				.limit(window);
			const matched = candidates.filter(
				(row) =>
					(input.publicationState === "all" || row.publicationState === input.publicationState) &&
					(input.status === "all" ||
						(input.status === "current" ? row.status !== "removed" : row.status === input.status)),
			);
			const page = matched.slice(0, limit);
			const readable = await input.authorization.unit.readableUnitIdsInTransaction(
				tx,
				page.map((row) => row.realmId),
			);
			const presentations = await readUnitPresentationsInTransaction(
				tx,
				[...readable],
				input.localizationLanguages,
			);
			const actionIds = page.flatMap((row) =>
				row.latestGovernanceActionId ? [row.latestGovernanceActionId] : [],
			);
			const actions = actionIds.length
				? await tx
						.select({
							actionId: contentGovernanceAction.id,
							actionKind: contentGovernanceAction.kind,
							createdAt: contentGovernanceAction.createdAt,
						})
						.from(contentGovernanceAction)
						.where(sql`${contentGovernanceAction.id}=any(${sql.param(actionIds)}::uuid[])`)
						.limit(actionIds.length)
				: [];
			const byId = new Map(actions.map((row) => [row.actionId, row]));
			const last =
				matched.length > limit
					? page.at(-1)
					: candidates.length === window
						? candidates.at(-1)
						: undefined;
			return {
				items: page.map(({ latestGovernanceActionId, ...row }) => ({
					...row,
					realmOwner: "realm" as const,
					language: presentations.get(row.realmId)?.language ?? null,
					title: presentations.get(row.realmId)?.title ?? null,
					effectivelyVisible: row.publicationState === "active" && row.status === "visible",
					latestGovernance: latestGovernanceActionId
						? (byId.get(latestGovernanceActionId) ?? null)
						: null,
				})),
				nextCursor: last ? ([last.updatedAt, last.realmId] as const) : null,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}
