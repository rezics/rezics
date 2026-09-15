import { realmEnrollment } from "../database/schema/realm-enrollment";
import {
	realmEnrollmentScope,
	realmMembershipAuthority,
	realmInvitationAdmission,
	enrollmentSubjectAuthority,
} from "./membership-policy";
import { requireAccessAdmission } from "../authorization/transaction";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import type { PrincipalRequestContext } from "../auth/principal-session";
import { realmRule, unitLocalization } from "../database/schema";
import {
	resolvedUnitLocalizationLanguage,
	type LocalizationLanguageQuery,
} from "../units/localization";
import { getCurrentRealmRules } from "./service";
import { readRealmEnrollment } from "./roster";
import { AccessUnavailable } from "../authorization/http-errors";
import { toPortableTextResponse } from "../api/schema/response";
/** Admission disclosures include exact rules for invited private recipients, without granting Realm content access. @alpha */
export async function readRealmEnrollmentRules(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	languages: LocalizationLanguageQuery,
) {
	const status = await readRealmEnrollment(tx, context, realmId);
	const scope = await realmEnrollmentScope(tx, realmId, false);
	let admission = scope.enrollmentAdmission;
	if (
		scope.record.visibility === "private" &&
		!(status.receipt?.activeGeneration != null && status.receipt.enforcement !== "banned")
	) {
		const actor = await enrollmentSubjectAuthority(tx, context, false);
		const [head] = await tx
			.select()
			.from(realmEnrollment)
			.where(
				and(
					eq(realmEnrollment.scopeId, scope.scopeId),
					eq(realmEnrollment.subjectId, actor.subjectId),
				),
			);
		admission = sql`(${admission}) and (${head?.state === "invited" ? await realmInvitationAdmission(tx, scope, head) : (await realmMembershipAuthority(tx, context, scope, false)).admission})`;
	}
	await requireAccessAdmission(tx, admission);
	const current = await getCurrentRealmRules(realmId, tx);
	if (!current) {
		await readRealmEnrollment(tx,context,realmId);
		await requireAccessAdmission(tx,admission);
		return {
			revisionId: null,
			version: null,
			acknowledgementMode: "explicit" as const,
			requireOnJoin: false,
			requireOnPost: false,
			items: [],
		};
	}
	const candidates = await tx
		.select({ id: realmRule.id })
		.from(realmRule)
		.where(eq(realmRule.revisionId, current.revisionId))
		.orderBy(realmRule.position, realmRule.id)
		.limit(257);
	if (candidates.length > 256) throw new AccessUnavailable();
	const items = candidates.length
		? await tx
				.select({
					id: realmRule.id,
					position: realmRule.position,
					language: unitLocalization.language,
					title: unitLocalization.title,
					content: unitLocalization.content,
				})
				.from(realmRule)
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, realmRule.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(realmRule.id, languages),
						),
					),
				)
				.where(
					inArray(
						realmRule.id,
						candidates.map((row) => row.id),
					),
				)
				.orderBy(realmRule.position, realmRule.id)
		: [];
	if (items.length !== candidates.length) throw new AccessUnavailable();
	await readRealmEnrollment(tx, context, realmId);
	await requireAccessAdmission(tx, admission);
	return {
		...current,
		items: items.map((item) => {
			if (!item.title) throw new AccessUnavailable();
			return {
				...item,
				title: item.title,
				content: toPortableTextResponse(item.content, "unit_localization.content"),
			};
		}),
	};
}
