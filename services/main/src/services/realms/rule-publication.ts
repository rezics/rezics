import type { PortableTextDocument } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { and, eq, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { authEntity, realmRuleRevision, unitLocalization, unitOwnership } from "../database/schema";
import { fractionalPositionAt } from "../ordering/position";
import { insertPlatformUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import type { RevisionContributionInput } from "../units/revision-contribution";
import { getCurrentRealmRules } from "./service";

export interface RealmRuleLocalizationPublication {
	readonly language: ContentLanguage;
	readonly title: string;
	readonly content: PortableTextDocument;
}

export interface RealmRulePublication {
	readonly localizations: readonly RealmRuleLocalizationPublication[];
}

export interface PublishRealmRuleRevisionInput {
	readonly realmId: string;
	readonly actorProfileId: string;
	readonly baseRevisionId: string | null;
	readonly acknowledgementMode: "explicit" | "implicit_on_follow";
	readonly requireOnJoin: boolean;
	readonly requireOnPost: boolean;
	readonly rules: readonly RealmRulePublication[];
	readonly contribution?: RevisionContributionInput;
	readonly publishedAt?: Date;
}

export type PublishRealmRuleRevisionResult =
	| {
			readonly status: "published";
			readonly revision: { readonly id: string; readonly version: number };
	  }
	| {
			readonly status: "revision_changed";
			readonly currentRevisionId: string | null;
	  }
	| {
			readonly status: "duplicate_localization";
			readonly ruleIndex: number;
	  };

function hasUniqueLocalizationLanguages(
	localizations: readonly RealmRuleLocalizationPublication[],
): boolean {
	return new Set(localizations.map(({ language }) => language)).size === localizations.length;
}

/**
 * Publishes one immutable Realm Rule revision through the same transaction path
 * used by API and initial-content writers.
 */
export async function publishRealmRuleRevision(
	tx: DatabaseTransaction,
	input: PublishRealmRuleRevisionInput,
): Promise<PublishRealmRuleRevisionResult> {
	const duplicateLocalizationRuleIndex = input.rules.findIndex(
		(rule) => !hasUniqueLocalizationLanguages(rule.localizations),
	);
	if (duplicateLocalizationRuleIndex !== -1)
		return { status: "duplicate_localization", ruleIndex: duplicateLocalizationRuleIndex };

	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.realmId}::text, 0))`);
	const latest = await getCurrentRealmRules(input.realmId, tx);
	const currentRevisionId = latest?.revisionId ?? null;
	if (input.baseRevisionId !== currentRevisionId)
		return { status: "revision_changed", currentRevisionId };

	const [actor] = await tx
		.select({ authUserId: authEntity.authUserId })
		.from(authEntity)
		.where(and(eq(authEntity.entityId, input.actorProfileId), eq(authEntity.state, "active")))
		.limit(1);
	if (!actor) throw new Error("Realm Rule publication requires an active authenticated creator");
	const publishedAt = input.publishedAt ?? new Date();
	const [created] = await tx
		.insert(realmRuleRevision)
		.values({
			realmId: input.realmId,
			version: (latest?.version ?? 0) + 1,
			acknowledgementMode: input.acknowledgementMode,
			requireOnJoin: input.requireOnJoin,
			requireOnPost: input.requireOnPost,
			createdByProfileId: input.actorProfileId,
			publishedAt,
		})
		.returning({ id: realmRuleRevision.id, version: realmRuleRevision.version });
	if (!created) throw new Error("Realm Rule revision insertion did not return a row");

	for (const [index, rule] of input.rules.entries()) {
		const ruleUnit = await insertPlatformUnit(tx, {
			owner: "realm_rule",
			values: {
				status: "published",
				visibility: "unlisted",
				publishedAt,
				createdAt: publishedAt,
				updatedAt: publishedAt,
				revisionId: created.id,
				position: index,
				createdByAuthUserId: actor.authUserId,
			},
			statusActor: { kind: "profile", profileId: input.actorProfileId },
		});
		await tx.insert(unitLocalization).values(
			rule.localizations.map((localization, localizationIndex) => ({
				unitId: ruleUnit.id,
				language: localization.language,
				position: fractionalPositionAt(localizationIndex),
				title: localization.title,
				content: localization.content,
				contentStatus: "published" as const,
			})),
		);
		await tx.insert(unitOwnership).values({
			unitId: ruleUnit.id,
			profileId: input.actorProfileId,
			assignedByProfileId: input.actorProfileId,
			createdAt: publishedAt,
			updatedAt: publishedAt,
		});
	}

	await recordUnitRevision(tx, {
		unitId: input.realmId,
		actorProfileId: input.actorProfileId,
		contribution: input.contribution,
		event: "update",
	});
	return { status: "published", revision: created };
}
