import { and, eq, sql } from "drizzle-orm";
import { Value } from "typebox/value";
import { DefaultStoredUiLocale, type UiLocale } from "@rezics/i18n";
import { parseLicenseId } from "@rezics/license";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { users } from "@rezics/schema/postgres/identity/auth";
import { accountPreference } from "@rezics/schema/postgres/identity/account-preference";
import type { DatabaseTransaction } from "../database";
import type { PrincipalRequestContext } from "../auth/principal-context";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import { allocateAccessSubject } from "../authorization/identities";
import { readAccessSubjectEligibility } from "../authorization/subject-eligibility";
import {
	AccessDenied,
	AccessUnavailable,
	AccessRecordUnavailable,
} from "../authorization/http-errors";
import { requireAccessAdmission, runAccessTransaction } from "../authorization/transaction";
import { readRealmEnrollment } from "../realms/roster";
import { realmEnrollmentScope } from "../realms/membership-policy";
import {
	ReplacePreferencesBody,
	UpdateDisplayPreferencesBody,
	UpdatePrivacyPreferencesBody,
	parseCollectionConfig,
} from "./preference-contracts";

type Operation = "read" | "display" | "privacy" | "replace";
async function ownSettings(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	operation: Operation,
) {
	if (context.selection.mode !== "direct") throw new AccessDenied();
	const query = tx
		.select({ id: users.id, language: users.registrationContentLanguage })
		.from(users)
		.where(eq(users.id, context.principalId));
	const [account] = operation === "read" ? await query.for("share") : await query.for("update");
	if (!account) throw new AccessDenied();
	await ensureAccountAuthenticationAllowed(account.id, tx);
	const credential = await readFirstPartyCredentialAuthority(tx, {
		proof: context.credentialProof(),
		selection: context.selection,
		apiPermission:
			operation === "privacy" ? null : operation === "read" ? "account:read" : "account:update",
		requireFreshSession: false,
		requireVerifiedEmail: operation === "replace",
	});
	const subjectId = await allocateAccessSubject(tx, { kind: "principal", id: account.id });
	// Display/privacy are personal controls available before verification and during a write restriction.
	const action = operation === "replace" ? "write" : "read";
	const [eligibility] = await readAccessSubjectEligibility(tx, { subjectIds: [subjectId], action });
	if (eligibility?.outcome === "deny") throw new AccessDenied();
	if (eligibility?.outcome !== "allow") throw new AccessUnavailable();
	const admission = sql<boolean>`(${credential.admission}) and public.access_subject_is_eligible(${subjectId}::uuid,${action}) is true`;
	return { account, admission };
}
async function preferences(
	tx: DatabaseTransaction,
	owner: Awaited<ReturnType<typeof ownSettings>>,
	locale: UiLocale,
) {
	const [existing] = await tx
		.select()
		.from(accountPreference)
		.where(eq(accountPreference.authUserId, owner.account.id));
	if (existing) return existing;
	await requireAccessAdmission(tx, owner.admission);
	await tx
		.insert(accountPreference)
		.values({
			authUserId: owner.account.id,
			interfaceLocale: locale,
			preferredLanguages: [owner.account.language],
		})
		.onConflictDoNothing();
	const [created] = await tx
		.select()
		.from(accountPreference)
		.where(eq(accountPreference.authUserId, owner.account.id));
	if (!created) throw new AccessUnavailable();
	return created;
}
function present(preference: typeof accountPreference.$inferSelect) {
	return {
		interfaceLocale: preference.interfaceLocale,
		chineseContentDisplay: preference.chineseContentDisplay,
		defaultLicenses: preference.defaultLicenses.map(parseLicenseId),
		defaultRealmManageMode: preference.defaultRealmManageMode,
		defaultScoreRealmId: preference.defaultScoreRealmId ?? OfficialRealmUnitIds.score,
		scoreVisibility: preference.scoreVisibility,
		progressVisibility: preference.progressVisibility,
		collectionConfig: parseCollectionConfig(preference.collectionConfig),
		personalizedFeed: preference.personalizedFeed,
		customThemesEnabled: preference.customThemesEnabled,
		filterFeedByPreferredLanguages: preference.filterFeedByPreferredLanguages,
		alwaysShowSpoilers: preference.alwaysShowSpoilers,
		alwaysShowNsfw: preference.alwaysShowNsfw,
		contentRatings: preference.contentRatings,
		preferredLanguages: preference.preferredLanguages,
	};
}
/** Private settings initialize from the account/request language without creating public identity or follows. @internal */
export async function readOwnPreferences(
	context: PrincipalRequestContext,
	locale: UiLocale = DefaultStoredUiLocale,
) {
	return runAccessTransaction(async (tx) => {
		const owner = await ownSettings(tx, context, "read"),
			current = await preferences(tx, owner, locale);
		await requireAccessAdmission(tx, owner.admission);
		return present(current);
	});
}
/** Replace only named display fields; current account and exact credential are fenced at the effect. @internal */
export async function updateOwnDisplayPreferences(
	context: PrincipalRequestContext,
	input: UpdateDisplayPreferencesBody,
	locale: UiLocale = DefaultStoredUiLocale,
) {
	const value = Value.Decode(UpdateDisplayPreferencesBody, input);
	return runAccessTransaction(async (tx) => {
		const owner = await ownSettings(tx, context, "display");
		await preferences(tx, owner, locale);
		const [updated] = await tx
			.update(accountPreference)
			.set(value)
			.where(and(eq(accountPreference.authUserId, owner.account.id), owner.admission))
			.returning();
		if (!updated) throw new AccessDenied();
		return present(updated);
	});
}
/** Session-only private privacy controls do not borrow a represented Entity or require verified email. @internal */
export async function updateOwnPrivacyPreferences(
	context: PrincipalRequestContext,
	input: UpdatePrivacyPreferencesBody,
	locale: UiLocale = DefaultStoredUiLocale,
) {
	const value = Value.Decode(UpdatePrivacyPreferencesBody, input);
	return runAccessTransaction(async (tx) => {
		const owner = await ownSettings(tx, context, "privacy");
		await preferences(tx, owner, locale);
		const [updated] = await tx
			.update(accountPreference)
			.set(value)
			.where(and(eq(accountPreference.authUserId, owner.account.id), owner.admission))
			.returning({
				scoreVisibility: accountPreference.scoreVisibility,
				progressVisibility: accountPreference.progressVisibility,
			});
		if (!updated) throw new AccessDenied();
		return updated;
	});
}
/**
 * Replace the account's complete preference set, preserving an unchanged default even if it becomes unusable.
 * @internal
 * @remarks A newly selected Realm must be disclosed to this private principal.
 * The preference grants no membership, representation or contribution authority;
 * actual Score/Post writes revalidate their own selected context and current policy.
 */
export async function replaceOwnPreferences(
	context: PrincipalRequestContext,
	input: ReplacePreferencesBody,
	locale: UiLocale = DefaultStoredUiLocale,
) {
	const value = Value.Decode(ReplacePreferencesBody, input);
	return runAccessTransaction(async (tx) => {
		const owner = await ownSettings(tx, context, "replace"),
			current = await preferences(tx, owner, locale);
		const sameRealm =
			value.defaultScoreRealmId === (current.defaultScoreRealmId ?? OfficialRealmUnitIds.score);
		if (!sameRealm) {
			const scope = await realmEnrollmentScope(tx, value.defaultScoreRealmId, false);
			const record = scope.record;
			if (
				record.deletedAt ||
				record.status !== "published" ||
				record.moderationStatus !== "approved"
			)
				throw new AccessRecordUnavailable();
			if (record.visibility === "private")
				await readRealmEnrollment(
					tx,
					context,
					value.defaultScoreRealmId,
					undefined,
					"account:update",
				);
		}
		const [updated] = await tx
			.update(accountPreference)
			.set({
				...value,
				defaultScoreRealmId: sameRealm ? current.defaultScoreRealmId : value.defaultScoreRealmId,
			})
			.where(and(eq(accountPreference.authUserId, owner.account.id), owner.admission))
			.returning();
		if (!updated) throw new AccessDenied();
		return present(updated);
	});
}
