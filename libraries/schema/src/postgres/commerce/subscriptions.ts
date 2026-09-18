import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { users } from "../identity/auth";
import { entityIdentity } from "../catalog/identity";
import { referenceValue } from "../knowledge/reference-value";
import { realm } from "../realms/realm";

const instant = () => timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull();
export const subscriptionOffering = pgTable(
	"subscription_offering",
	{
		id: uuid().primaryKey(),
		targetRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
		operatorEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id),
		state: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		createdAt: instant(),
	},
	(t) => [
		index("subscription_offering_target").on(t.targetRefId, t.id),
		index("subscription_offering_operator").on(t.operatorEntityId, t.id),
		check(
			"subscription_offering_state",
			sql`${t.state} in ('draft','active','retired') and ${t.revision}>0`,
		),
	],
);
export const subscriptionPlanGroup = pgTable(
	"subscription_plan_group",
	{
		id: uuid().primaryKey(),
		offeringId: uuid()
			.notNull()
			.references(() => subscriptionOffering.id),
		mode: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		unique("subscription_group_offering").on(t.id, t.offeringId),
		check(
			"subscription_group_mode",
			sql`${t.mode} in ('replaceable','parallel') and ${t.revision}>0`,
		),
	],
);
export const subscriptionPlan = pgTable(
	"subscription_plan",
	{
		id: uuid().primaryKey(),
		offeringId: uuid().notNull(),
		groupId: uuid().notNull(),
		key: text().notNull(),
		state: text().notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.groupId, t.offeringId],
			foreignColumns: [subscriptionPlanGroup.id, subscriptionPlanGroup.offeringId],
		}),
		unique("subscription_plan_key").on(t.offeringId, t.key),
		unique("subscription_plan_scope").on(t.id, t.groupId, t.offeringId),
	],
);
export const subscriptionPlanRevision = pgTable(
	"subscription_plan_revision",
	{
		planId: uuid()
			.notNull()
			.references(() => subscriptionPlan.id),
		id: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		title: text().notNull(),
		terms: jsonb().$type<Record<string, unknown>>().notNull(),
		createdAt: instant(),
	},
	(t) => [
		primaryKey({ columns: [t.planId, t.id] }),
		unique("subscription_plan_revision_number").on(t.planId, t.revision),
		check("subscription_plan_terms", sql`${t.revision}>0 and jsonb_typeof(${t.terms})='object'`),
	],
);
export const subscriptionPrice = pgTable(
	"subscription_price",
	{
		id: uuid().primaryKey(),
		planId: uuid().notNull(),
		planRevisionId: uuid().notNull(),
		currency: text().notNull(),
		minorUnits: numeric().notNull(),
		intervalUnit: text().notNull(),
		intervalCount: integer().notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.planId, t.planRevisionId],
			foreignColumns: [subscriptionPlanRevision.planId, subscriptionPlanRevision.id],
		}),
		unique("subscription_price_plan").on(t.id, t.planId, t.planRevisionId),
		check(
			"subscription_price_value",
			sql`${t.currency} ~ '^[A-Z]{3}$' and ${t.minorUnits}>=0 and ${t.minorUnits}=trunc(${t.minorUnits}) and ${t.minorUnits}<1e40 and ${t.intervalCount}>0 and ${t.intervalUnit} in ('day','week','month','year','one-time')`,
		),
	],
);
export const subscriptionBenefit = pgTable(
	"subscription_benefit",
	{
		id: uuid().primaryKey(),
		namespace: text().notNull(),
		key: text().notNull(),
		kind: text().notNull(),
	},
	(t) => [
		unique("subscription_benefit_key").on(t.namespace, t.key),
		check(
			"subscription_benefit_kind",
			sql`${t.kind} in ('audience','quota','content','participation')`,
		),
	],
);
export const subscriptionBenefitRevision = pgTable(
	"subscription_benefit_revision",
	{
		benefitId: uuid()
			.notNull()
			.references(() => subscriptionBenefit.id),
		id: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		contract: jsonb().$type<Record<string, unknown>>().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.benefitId, t.id] }),
		unique("subscription_benefit_revision_number").on(t.benefitId, t.revision),
	],
);
export const subscriptionBenefitBinding = pgTable(
	"subscription_benefit_binding",
	{
		planId: uuid().notNull(),
		planRevisionId: uuid().notNull(),
		benefitId: uuid().notNull(),
		benefitRevisionId: uuid().notNull(),
		scopeRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
	},
	(t) => [
		primaryKey({ columns: [t.planId, t.planRevisionId, t.benefitId, t.scopeRefId] }),
		foreignKey({
			columns: [t.planId, t.planRevisionId],
			foreignColumns: [subscriptionPlanRevision.planId, subscriptionPlanRevision.id],
		}),
		foreignKey({
			columns: [t.benefitId, t.benefitRevisionId],
			foreignColumns: [subscriptionBenefitRevision.benefitId, subscriptionBenefitRevision.id],
		}),
	],
);
export const subscriptionAgreement = pgTable(
	"subscription_agreement",
	{
		id: uuid().primaryKey(),
		beneficiaryUserId: uuid()
			.notNull()
			.references(() => users.id),
		payerUserId: uuid()
			.notNull()
			.references(() => users.id),
		planId: uuid()
			.notNull()
			.references(() => subscriptionPlan.id),
		provider: text().notNull(),
		providerAccount: text().notNull(),
		environment: text().notNull(),
		externalId: text().notNull(),
		state: text().notNull(),
		createdAt: instant(),
	},
	(t) => [
		unique("subscription_agreement_provider").on(
			t.provider,
			t.providerAccount,
			t.environment,
			t.externalId,
		),
		unique("subscription_agreement_beneficiary").on(t.id, t.beneficiaryUserId),
		index("subscription_agreement_private").on(t.beneficiaryUserId, t.id),
	],
);
export const subscriptionAgreementRevision = pgTable(
	"subscription_agreement_revision",
	{
		agreementId: uuid()
			.notNull()
			.references(() => subscriptionAgreement.id),
		id: uuid().notNull(),
		planId: uuid().notNull(),
		planRevisionId: uuid().notNull(),
		priceId: uuid().notNull(),
		startsAt: timestamp({ withTimezone: true }).notNull(),
		endsAt: timestamp({ withTimezone: true }),
		renew: boolean().notNull(),
		createdAt: instant(),
	},
	(t) => [
		primaryKey({ columns: [t.agreementId, t.id] }),
		foreignKey({
			columns: [t.priceId, t.planId, t.planRevisionId],
			foreignColumns: [
				subscriptionPrice.id,
				subscriptionPrice.planId,
				subscriptionPrice.planRevisionId,
			],
		}),
		check("subscription_agreement_interval", sql`${t.endsAt} is null or ${t.endsAt}>${t.startsAt}`),
	],
);
export const subscriptionOperation = pgTable(
	"subscription_operation",
	{
		id: uuid().primaryKey(),
		actorUserId: uuid()
			.notNull()
			.references(() => users.id),
		nonce: text().notNull(),
		payloadDigest: text().notNull(),
		agreementId: uuid().references(() => subscriptionAgreement.id),
		state: text().notNull(),
		createdAt: instant(),
	},
	(t) => [
		unique("subscription_operation_retry").on(t.actorUserId, t.nonce),
		check(
			"subscription_operation_state",
			sql`${t.state} in ('prepared','pending','settled','failed','cancelled')`,
		),
	],
);
export const subscriptionProviderEvent = pgTable(
	"subscription_provider_event",
	{
		id: uuid().primaryKey(),
		provider: text().notNull(),
		providerAccount: text().notNull(),
		environment: text().notNull(),
		externalId: text().notNull(),
		digest: text().notNull(),
		verifiedAt: timestamp({ withTimezone: true }).notNull(),
		payload: jsonb().$type<Record<string, unknown>>().notNull(),
	},
	(t) => [
		unique("subscription_provider_event_key").on(
			t.provider,
			t.providerAccount,
			t.environment,
			t.externalId,
		),
	],
);
export const subscriptionProviderEffect = pgTable(
	"subscription_provider_effect",
	{
		eventId: uuid()
			.notNull()
			.references(() => subscriptionProviderEvent.id),
		effect: text().notNull(),
		agreementId: uuid()
			.notNull()
			.references(() => subscriptionAgreement.id),
		operationId: uuid().references(() => subscriptionOperation.id),
		appliedAt: instant(),
	},
	(t) => [primaryKey({ columns: [t.eventId, t.effect] })],
);
export const complimentaryAward = pgTable(
	"complimentary_award",
	{
		id: uuid().primaryKey(),
		beneficiaryUserId: uuid()
			.notNull()
			.references(() => users.id),
		issuerEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id),
		reason: text().notNull(),
		receiptKey: text().notNull(),
		createdAt: instant(),
	},
	(t) => [
		unique("complimentary_award_retry").on(t.issuerEntityId, t.receiptKey),
		unique("complimentary_award_beneficiary").on(t.id, t.beneficiaryUserId),
	],
);
export const contributorAward = pgTable(
	"contributor_award",
	{
		id: uuid().primaryKey(),
		beneficiaryUserId: uuid()
			.notNull()
			.references(() => users.id),
		issuerEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id),
		contributionRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
		decisionId: uuid().notNull(),
		createdAt: instant(),
	},
	(t) => [
		unique("contributor_award_decision").on(t.issuerEntityId, t.decisionId),
		unique("contributor_award_beneficiary").on(t.id, t.beneficiaryUserId),
	],
);
export const entitlementGrant = pgTable(
	"entitlement_grant",
	{
		id: uuid().primaryKey(),
		beneficiaryUserId: uuid()
			.notNull()
			.references(() => users.id),
		benefitId: uuid().notNull(),
		benefitRevisionId: uuid().notNull(),
		scopeRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
		agreementId: uuid(),
		complimentaryAwardId: uuid(),
		contributorAwardId: uuid(),
	},
	(t) => [
		foreignKey({
			columns: [t.benefitId, t.benefitRevisionId],
			foreignColumns: [subscriptionBenefitRevision.benefitId, subscriptionBenefitRevision.id],
		}),
		foreignKey({
			columns: [t.agreementId, t.beneficiaryUserId],
			foreignColumns: [subscriptionAgreement.id, subscriptionAgreement.beneficiaryUserId],
		}),
		foreignKey({
			columns: [t.complimentaryAwardId, t.beneficiaryUserId],
			foreignColumns: [complimentaryAward.id, complimentaryAward.beneficiaryUserId],
		}),
		foreignKey({
			columns: [t.contributorAwardId, t.beneficiaryUserId],
			foreignColumns: [contributorAward.id, contributorAward.beneficiaryUserId],
		}),
		check(
			"entitlement_grant_one_source",
			sql`num_nonnulls(${t.agreementId},${t.complimentaryAwardId},${t.contributorAwardId})=1`,
		),
		index("entitlement_grant_lookup").on(t.beneficiaryUserId, t.benefitId, t.scopeRefId, t.id),
	],
);
export const entitlementGrantRevision = pgTable(
	"entitlement_grant_revision",
	{
		grantId: uuid()
			.notNull()
			.references(() => entitlementGrant.id),
		revision: bigint({ mode: "number" }).notNull(),
		startsAt: timestamp({ withTimezone: true }).notNull(),
		endsAt: timestamp({ withTimezone: true }),
		revokedAt: timestamp({ withTimezone: true }),
		reason: text().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.grantId, t.revision] }),
		check(
			"entitlement_grant_interval",
			sql`${t.revision}>0 and (${t.endsAt} is null or ${t.endsAt}>${t.startsAt})`,
		),
	],
);
export const entitlementBenefitHead = pgTable(
	"entitlement_benefit_head",
	{
		beneficiaryUserId: uuid()
			.notNull()
			.references(() => users.id),
		benefitId: uuid()
			.notNull()
			.references(() => subscriptionBenefit.id),
		scopeRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
		revision: bigint({ mode: "number" }).notNull(),
		complete: boolean().notNull(),
		active: boolean().notNull(),
		nextBoundaryAt: timestamp({ withTimezone: true }),
	},
	(t) => [
		primaryKey({ columns: [t.beneficiaryUserId, t.benefitId, t.scopeRefId] }),
		index("entitlement_head_due").on(t.nextBoundaryAt, t.beneficiaryUserId),
	],
);
export const realmParticipationPolicy = pgTable(
	"realm_participation_policy",
	{
		realmId: uuid()
			.primaryKey()
			.references(() => realm.id),
		revision: bigint({ mode: "number" }).notNull(),
		currentRevisionId: uuid(),
	},
	(t) => [
		foreignKey({
			columns: [t.realmId, t.currentRevisionId],
			foreignColumns: [
				realmParticipationPolicyRevision.realmId,
				realmParticipationPolicyRevision.id,
			],
		}),
	],
);
export const realmParticipationPolicyRevision = pgTable(
	"realm_participation_policy_revision",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id),
		id: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		admission: jsonb().$type<Record<string, unknown>>().notNull(),
		metering: jsonb().$type<Record<string, unknown>>().notNull(),
		review: jsonb().$type<Record<string, unknown>>().notNull(),
		createdAt: instant(),
	},
	(t) => [
		primaryKey({ columns: [t.realmId, t.id] }),
		unique("realm_participation_policy_version").on(t.realmId, t.revision),
	],
);
export const participationMeter = pgTable(
	"participation_meter",
	{
		id: uuid().primaryKey(),
		realmId: uuid()
			.notNull()
			.references(() => realm.id),
		beneficiaryUserId: uuid()
			.notNull()
			.references(() => users.id),
		action: text().notNull(),
		unit: text().notNull(),
		windowKey: text().notNull(),
		balance: numeric().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		check(
			"participation_meter_balance_integer",
			sql`${t.balance}=trunc(${t.balance}) and abs(${t.balance})<1e40`,
		),
		unique("participation_meter_scope").on(
			t.realmId,
			t.beneficiaryUserId,
			t.action,
			t.unit,
			t.windowKey,
		),
	],
);
export const participationMeterEntry = pgTable(
	"participation_meter_entry",
	{
		meterId: uuid()
			.notNull()
			.references(() => participationMeter.id),
		id: uuid().notNull(),
		operationKey: text().notNull(),
		delta: numeric().notNull(),
		compensatesId: uuid(),
		createdAt: instant(),
	},
	(t) => [
		check(
			"participation_meter_delta_integer",
			sql`${t.delta}=trunc(${t.delta}) and abs(${t.delta})<1e40`,
		),
		primaryKey({ columns: [t.meterId, t.id] }),
		unique("participation_meter_effect").on(t.meterId, t.operationKey),
		unique("participation_meter_compensation").on(t.meterId, t.compensatesId),
		foreignKey({ columns: [t.meterId, t.compensatesId], foreignColumns: [t.meterId, t.id] }),
	],
);
export const participationSubmission = pgTable(
	"participation_submission",
	{
		id: uuid().primaryKey(),
		realmId: uuid().notNull(),
		policyRevisionId: uuid().notNull(),
		targetRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
		targetRevisionId: uuid().notNull(),
		authorUserId: uuid()
			.notNull()
			.references(() => users.id),
		state: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		createdAt: instant(),
	},
	(t) => [
		foreignKey({
			columns: [t.realmId, t.policyRevisionId],
			foreignColumns: [
				realmParticipationPolicyRevision.realmId,
				realmParticipationPolicyRevision.id,
			],
		}),
		unique("participation_submission_exact").on(t.id, t.policyRevisionId, t.targetRevisionId),
		index("participation_submission_queue").on(t.realmId, t.state, t.createdAt, t.id),
	],
);
export const participationReviewAttempt = pgTable(
	"participation_review_attempt",
	{
		submissionId: uuid()
			.notNull()
			.references(() => participationSubmission.id),
		id: uuid().notNull(),
		policyRevisionId: uuid().notNull(),
		targetRevisionId: uuid().notNull(),
		leaseToken: uuid().notNull(),
		state: text().notNull(),
		findings: jsonb().$type<Record<string, unknown>>(),
		createdAt: instant(),
	},
	(t) => [
		primaryKey({ columns: [t.submissionId, t.id] }),
		foreignKey({
			columns: [t.submissionId, t.policyRevisionId, t.targetRevisionId],
			foreignColumns: [
				participationSubmission.id,
				participationSubmission.policyRevisionId,
				participationSubmission.targetRevisionId,
			],
		}),
	],
);
