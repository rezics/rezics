import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import type { DatabaseExecutor } from "../database";
import { DemoCredentials, position, SeedPlan } from "./data";

/** Inspect bounded synthetic actors and their native consent/history; never writes or repairs state. @internal */
export async function verifySeedEnrollments(db: DatabaseExecutor) {
	const emails = Array.from({ length: SeedPlan.users }, (_, index) =>
		index === 0 ? DemoCredentials.email : `seed-user-${position(index)}@example.test`,
	);
	const result = (
		await db.execute<{
			actors: number;
			main_choices: number;
			unverified: number;
			heads: number;
			pending: number;
			muted: number;
			missing_consent: number;
			missing_receipt: number;
			invalid_generation: number;
			invalid_pending: number;
			rule_acceptances: number;
			missing_required_rules: number;
			unlabelled_rule_consent: number;
		}>(sql`
 with actors as materialized(
  select u.id,u.email_verified,a.entity_id,a.representation_id from public.users u
  join public.account_identity_admission a on a.auth_user_id=u.id and a.main_preference_version=1
  where u.email=any(${sql.param(emails)}::text[])
 ), enrollments as materialized(
  select e.*,s.entity_id,a.id as actor_id,m.active_generation,m.last_generation,m.version as membership_version,
   r.join_policy,coalesce(f.state,'clear') as enforcement
  from actors a join public.access_subject s on s.entity_id=a.entity_id
  join public.realm_enrollment e on e.subject_id=s.id
  join public.access_membership m on m.id=e.membership_id
  join public.realm r on r.id=e.realm_id
  left join public.realm_enforcement f on f.scope_id=e.scope_id and f.subject_id=e.subject_id
 ) select
  (select count(*)::integer from actors) as actors,
  (select count(*)::integer from actors a join public.identity_preference p on p.auth_user_id=a.id and p.client_id is null
    and p.selection_kind='entity' and p.entity_id=a.entity_id and p.version=1
    where public.access_representation_is_current(a.representation_id,1) is true) as main_choices,
  (select count(*)::integer from actors where not email_verified) as unverified,
  (select count(*)::integer from enrollments) as heads,
  (select count(*)::integer from enrollments where state='pending') as pending,
  (select count(*)::integer from enrollments where enforcement='muted') as muted,
  (select count(*)::integer from enrollments where consent is null or notification_basis is null
    or consent->>'principalId' is distinct from actor_id::text
    or consent#>>'{selection,entityId}' is distinct from entity_id::text) as missing_consent,
  (select count(*)::integer from enrollments e where not exists(select 1 from public.realm_enrollment_operation o
    where o.scope_id=e.scope_id and o.subject_id=e.subject_id and o.revision=e.revision)) as missing_receipt,
  (select count(*)::integer from enrollments where (state='approved' and (active_generation is distinct from 1 or last_generation<>1 or membership_version<>1))
    or (state='pending' and (active_generation is not null or membership_version<>0))) as invalid_generation,
  (select count(*)::integer from enrollments where state='pending' and join_policy<>'approval') as invalid_pending,
  (select count(*)::integer from enrollments e join public.realm_enrollment_rule_acceptance a
    on a.membership_id=e.membership_id and a.generation=e.active_generation) as rule_acceptances,
  (select count(*)::integer from enrollments e where e.active_generation is not null and exists(
    select 1 from public.realm_rule_revision r where r.realm_id=e.realm_id and r.require_on_join
    and not exists(select 1 from public.realm_enrollment_rule_acceptance a where a.membership_id=e.membership_id
      and a.generation=e.active_generation and a.revision_id=r.id))) as missing_required_rules,
  (select count(*)::integer from enrollments e join public.realm_enrollment_rule_acceptance a
    on a.membership_id=e.membership_id and a.generation=e.active_generation where a.language is null) as unlabelled_rule_consent
 `)
	).rows[0];
	assert.ok(result, "Native seed enrollment result is missing");
	assert.equal(
		result.actors,
		SeedPlan.users,
		"Every fixture account has native public identity admission",
	);
	assert.equal(
		result.main_choices,
		SeedPlan.users,
		"Every fixture account retains its explicit native main choice and representation",
	);
	assert.equal(
		result.unverified,
		9,
		"Withdrawal scenarios retain the declared unverified accounts",
	);
	assert.equal(
		result.heads,
		SeedPlan.users + SeedPlan.realmMembers,
		"Seed member counts come from native enrollment heads",
	);
	assert.equal(result.pending, 16, "Only approval Realms contain pending applications");
	assert.equal(result.muted, 48, "Muted examples use independent Realm enforcement");
	for (const field of [
		"missing_consent",
		"missing_receipt",
		"invalid_generation",
		"invalid_pending",
		"missing_required_rules",
		"unlabelled_rule_consent",
	] as const)
		assert.equal(result[field], 0, `Seed native enrollment invariant: ${field}`);
	assert.ok(
		result.rule_acceptances >= SeedPlan.minimumRealmRuleAcceptances,
		"Required and elective rules retain exact active-generation consent",
	);
	return result;
}
