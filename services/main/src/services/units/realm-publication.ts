import type { ContentLanguage } from "@rezics/i18n";
import { and, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

import type { Authorization } from "../authorization";
import { database, type DatabaseTransaction } from "../database";
import {
	moderationAction,
	moderationCase,
	realmUnit,
	realmUnitPublicationEvent,
	unit,
} from "../database/schema";
import { resolvedUnitLocalizationLanguage, resolvedUnitLocalizationTitle } from "./localization";
import {
	UnitRealmPublicationAlreadyExists,
	UnitRealmPublicationNotFound,
	UnitRealmPublicationTransitionInvalid,
} from "./errors";

export type UnitRealmPublicationState = "active" | "withdrawn";
export type UnitRealmPublicationStateFilter = UnitRealmPublicationState | "all";
export type UnitRealmPublicationStatusFilter =
	"current" | "all" | "pending" | "visible" | "hidden" | "removed";

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
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly publicationState: UnitRealmPublicationStateFilter;
	readonly status: UnitRealmPublicationStatusFilter;
	readonly cursor?: PublicationCursor;
	readonly limit: number;
}) {
	await input.authorization.unit.ensure(input.unitId, "unit.realm-publication.manage");
	const rows = await database
		.select({
			realmId: realmUnit.realmId,
			realmKind: sql<"realm">`'realm'`,
			language: resolvedUnitLocalizationLanguage(
				realmUnit.realmId,
				input.localizationLanguages,
			),
			title: resolvedUnitLocalizationTitle(realmUnit.realmId, input.localizationLanguages),
			publicationState: realmUnit.publicationState,
			status: realmUnit.status,
			createdAt: realmUnit.createdAt,
			updatedAt: realmUnit.updatedAt,
		})
		.from(realmUnit)
		.innerJoin(unit, eq(unit.id, realmUnit.realmId))
		.where(
			and(
				eq(realmUnit.unitId, input.unitId),
				input.publicationState === "all"
					? undefined
					: eq(realmUnit.publicationState, input.publicationState),
				input.status === "current"
					? inArray(realmUnit.status, ["pending", "visible", "hidden"])
					: input.status === "all"
						? undefined
						: eq(realmUnit.status, input.status),
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
		.limit(input.limit);
	const realmIds = rows.map((row) => row.realmId);
	const governanceRows = realmIds.length
		? await database
				.selectDistinctOn([moderationCase.realmId], {
					realmId: moderationCase.realmId,
					actionId: moderationAction.id,
					reasonCode: moderationAction.reasonCode,
					createdAt: moderationAction.createdAt,
				})
				.from(moderationAction)
				.innerJoin(moderationCase, eq(moderationCase.id, moderationAction.caseId))
				.where(
					and(
						eq(moderationCase.authority, "realm"),
						inArray(moderationCase.realmId, realmIds),
						eq(moderationCase.targetKind, "realm_unit"),
						eq(moderationCase.targetId, input.unitId),
						isNotNull(moderationAction.resultingState),
					),
				)
				.orderBy(
					moderationCase.realmId,
					desc(moderationAction.createdAt),
					desc(moderationAction.id),
				)
		: [];
	const governanceByRealm = new Map(
		governanceRows.flatMap((row) =>
			row.realmId
				? [
						[
							row.realmId,
							{
								actionId: row.actionId,
								reasonCode: row.reasonCode,
								createdAt: row.createdAt,
							},
						] as const,
					]
				: [],
		),
	);
	return rows.map((row) => {
		if (!row.language) throw new Error(`Realm ${row.realmId} has no localization`);
		return {
			...row,
			language: row.language,
			effectivelyVisible: row.publicationState === "active" && row.status === "visible",
			latestGovernance: governanceByRealm.get(row.realmId) ?? null,
		};
	});
}
