import type {
	CollectionFilter,
	ContentLanguageSupportFilter,
	IntegerFilter,
	LocalizationFilter,
	PostFilter,
	ProfileReferenceFilter,
	RealmPlacementFilter,
	ScoreFilter,
	ScoreValueFilter,
	TagAssertionFilter,
	UnitPredicate,
	UnitReferenceFilter,
	VoteSummaryFilter,
} from "@rezics/filter";
import { sql, type SQL } from "drizzle-orm";

import { currentUnitEffectiveTag, currentUnitTagJudgmentStat } from "../database/schema";

type SqlName = SQL<unknown>;

function conjunction(conditions: readonly SQL[]): SQL {
	if (!conditions.length) return sql`true`;
	if (conditions.length === 1) return conditions[0]!;
	return sql`(${sql.join([...conditions], sql` and `)})`;
}

function disjunction(conditions: readonly SQL[]): SQL {
	if (!conditions.length) return sql`false`;
	if (conditions.length === 1) return conditions[0]!;
	return sql`(${sql.join([...conditions], sql` or `)})`;
}

function valuesCondition(column: SqlName, values: readonly (string | number)[], uuid = false): SQL {
	return sql`${column} in (${sql.join(
		values.map((value) => (uuid ? sql`${value}::uuid` : sql`${value}`)),
		sql`, `,
	)})`;
}

function integerCondition(column: SqlName, filter: IntegerFilter | ScoreValueFilter): SQL {
	if ("in" in filter) return valuesCondition(column, filter.in);
	return conjunction([
		filter.range.minimum === undefined ? sql`true` : sql`${column} >= ${filter.range.minimum}`,
		filter.range.maximum === undefined ? sql`true` : sql`${column} <= ${filter.range.maximum}`,
	]);
}

function logicConditions<T extends { all?: T[]; any?: T[]; not?: T }>(
	filter: T,
	compile: (child: T) => SQL,
): SQL[] {
	return [
		...(filter.all ? [conjunction(filter.all.map(compile))] : []),
		...(filter.any ? [disjunction(filter.any.map(compile))] : []),
		...(filter.not ? [sql`not (${compile(filter.not)})`] : []),
	];
}

function unitReferenceCondition(filter: UnitReferenceFilter, id: SqlName, kind?: SqlName): SQL {
	const conditions: SQL[] = [];
	if (filter.id) conditions.push(valuesCondition(id, filter.id.in, true));
	if (filter.kind) {
		if (!kind) return sql`false`;
		conditions.push(valuesCondition(kind, filter.kind.in));
	}
	return conjunction(conditions);
}

function profileReferenceCondition(
	filter: ProfileReferenceFilter,
	column: SqlName,
	viewerProfileId?: string,
): SQL {
	if (filter.kind === "viewer")
		return viewerProfileId ? sql`${column} = ${viewerProfileId}::uuid` : sql`false`;
	return valuesCondition(column, filter.id.in, true);
}

function localizationCondition(filter: LocalizationFilter): SQL {
	const conditions = logicConditions(filter, localizationCondition);
	if (filter.language)
		conditions.push(valuesCondition(sql`filter_localization.language`, filter.language.in));
	return conjunction(conditions);
}

const ContentLanguageChannelMasks = {
	text: [1, 3, 5, 7, 9, 11, 13, 15],
	audio: [2, 3, 6, 7, 10, 11, 14, 15],
	subtitle: [4, 5, 6, 7, 12, 13, 14, 15],
	interface: [8, 9, 10, 11, 12, 13, 14, 15],
} as const satisfies Record<
	NonNullable<ContentLanguageSupportFilter["channel"]>,
	readonly number[]
>;

function contentLanguageSupportCondition(filter: ContentLanguageSupportFilter): SQL {
	return conjunction([
		sql`filter_content_language.language_tag = ${filter.languageTag}`,
		...(filter.channel
			? [
					valuesCondition(
						sql`filter_content_language.channel_mask`,
						ContentLanguageChannelMasks[filter.channel],
					),
				]
			: []),
	]);
}

function realmPlacementCondition(filter: RealmPlacementFilter): SQL {
	const conditions = logicConditions(filter, realmPlacementCondition);
	if (filter.realm)
		conditions.push(
			unitReferenceCondition(filter.realm, sql`filter_realm_unit.realm_id`, sql`filter_realm.kind`),
		);
	if (filter.status)
		conditions.push(valuesCondition(sql`filter_realm_unit.status`, filter.status.in));
	if (filter.publicationState)
		conditions.push(
			valuesCondition(sql`filter_realm_unit.publication_state`, filter.publicationState.in),
		);
	return conjunction(conditions);
}

function voteSummaryCondition(
	filter: VoteSummaryFilter,
	scoreColumn: SqlName,
	voteCountColumn: SqlName,
): SQL {
	return conjunction([
		...(filter.score ? [integerCondition(scoreColumn, filter.score)] : []),
		...(filter.voteCount ? [integerCondition(voteCountColumn, filter.voteCount)] : []),
	]);
}

function tagAssertionCondition(
	filter: TagAssertionFilter,
	unitId: SqlName,
	viewerProfileId?: string,
): SQL {
	const conditions = logicConditions(filter, (child) =>
		tagAssertionCondition(child, unitId, viewerProfileId),
	);
	const tagReference = (tagId: SqlName, tagKind: SqlName) =>
		filter.tag ? unitReferenceCondition(filter.tag, tagId, tagKind) : sql`true`;
	const authority = filter.authority;
	if (!authority) {
		conditions.push(sql`exists (
			select 1
			from ${currentUnitEffectiveTag} filter_effective_tag
			join unit filter_tag on filter_tag.id = filter_effective_tag.tag_id
			where filter_effective_tag.unit_id = ${unitId}
				and ${tagReference(sql`filter_effective_tag.tag_id`, sql`filter_tag.kind`)}
		)`);
		return conjunction(conditions);
	}
	if (authority.kind === "global" && authority.view.kind === "effective") {
		const consensus = authority.view.consensus;
		conditions.push(sql`exists (
			select 1
			from ${currentUnitEffectiveTag} filter_effective_tag
			join unit filter_tag on filter_tag.id = filter_effective_tag.tag_id
			${
				consensus
					? sql`join ${currentUnitTagJudgmentStat} filter_tag_stat
						on filter_tag_stat.unit_id = filter_effective_tag.unit_id
						and filter_tag_stat.tag_id = filter_effective_tag.tag_id`
					: sql``
			}
			where filter_effective_tag.unit_id = ${unitId}
				and ${tagReference(sql`filter_effective_tag.tag_id`, sql`filter_tag.kind`)}
				${
					consensus
						? sql`and filter_tag_stat.vote_count > 0
							and ${voteSummaryCondition(
								consensus,
								sql`filter_tag_stat.score`,
								sql`filter_tag_stat.vote_count`,
							)}`
						: sql``
				}
		)`);
	} else if (authority.kind === "global") {
		conditions.push(sql`exists (
			select 1
			from unit_tag filter_unit_tag
			join unit filter_tag on filter_tag.id = filter_unit_tag.tag_id
			where filter_unit_tag.unit_id = ${unitId}
				and ${tagReference(sql`filter_unit_tag.tag_id`, sql`filter_tag.kind`)}
		)`);
	} else if (authority.kind === "realm" && authority.view.kind === "policy") {
		conditions.push(sql`exists (
			select 1
			from realm_unit_tag filter_realm_tag
			join unit filter_tag on filter_tag.id = filter_realm_tag.tag_id
			join unit filter_authority_realm on filter_authority_realm.id = filter_realm_tag.realm_id
			where filter_realm_tag.unit_id = ${unitId}
				and ${unitReferenceCondition(
					authority.realm,
					sql`filter_realm_tag.realm_id`,
					sql`filter_authority_realm.kind`,
				)}
				and ${tagReference(sql`filter_realm_tag.tag_id`, sql`filter_tag.kind`)}
		)`);
	} else if (authority.kind === "realm") {
		const view = authority.view;
		if (view.kind !== "community") return conjunction([...conditions, sql`false`]);
		const consensus = view.consensus;
		conditions.push(sql`exists (
			select 1
			from realm_tag_judgment_stat filter_realm_tag_stat
			join unit filter_tag on filter_tag.id = filter_realm_tag_stat.tag_id
			join unit filter_authority_realm
				on filter_authority_realm.id = filter_realm_tag_stat.realm_id
			where filter_realm_tag_stat.unit_id = ${unitId}
				and ${unitReferenceCondition(
					authority.realm,
					sql`filter_realm_tag_stat.realm_id`,
					sql`filter_authority_realm.kind`,
				)}
				and ${tagReference(sql`filter_realm_tag_stat.tag_id`, sql`filter_tag.kind`)}
				and filter_realm_tag_stat.vote_count > 0
				${
					consensus
						? sql`and ${voteSummaryCondition(
								consensus,
								sql`filter_realm_tag_stat.score`,
								sql`filter_realm_tag_stat.vote_count`,
							)}`
						: sql``
				}
		)`);
	} else {
		conditions.push(
			viewerProfileId
				? sql`exists (
					select 1
					from profile_unit_tag filter_profile_tag
					join unit filter_tag on filter_tag.id = filter_profile_tag.tag_id
					where filter_profile_tag.unit_id = ${unitId}
						and filter_profile_tag.profile_id = ${viewerProfileId}::uuid
						and ${tagReference(sql`filter_profile_tag.tag_id`, sql`filter_tag.kind`)}
				)`
				: sql`false`,
		);
	}
	return conjunction(conditions);
}

function scoreCondition(
	filter: ScoreFilter,
	columns: {
		value: SqlName;
		realmId: SqlName;
		realmKind?: SqlName;
		targetId: SqlName;
		targetKind?: SqlName;
		authorId: SqlName;
	},
	viewerProfileId?: string,
): SQL {
	const conditions = logicConditions(filter, (child) =>
		scoreCondition(child, columns, viewerProfileId),
	);
	if (filter.value) conditions.push(integerCondition(columns.value, filter.value));
	if (filter.realm)
		conditions.push(unitReferenceCondition(filter.realm, columns.realmId, columns.realmKind));
	if (filter.target)
		conditions.push(unitReferenceCondition(filter.target, columns.targetId, columns.targetKind));
	if (filter.author)
		conditions.push(profileReferenceCondition(filter.author, columns.authorId, viewerProfileId));
	return conjunction(conditions);
}

function postCondition(filter: PostFilter, viewerProfileId?: string): SQL {
	const conditions = logicConditions(filter, (child) => postCondition(child, viewerProfileId));
	if (filter.kind) conditions.push(valuesCondition(sql`filter_post.kind`, filter.kind.in));
	if (filter.subject)
		conditions.push(
			"is" in filter.subject
				? filter.subject.is.kind
					? sql`exists (
						select 1 from unit filter_subject
						where filter_subject.id = filter_post.subject_unit_id
							and ${unitReferenceCondition(filter.subject.is, sql`filter_subject.id`, sql`filter_subject.kind`)}
					)`
					: unitReferenceCondition(filter.subject.is, sql`filter_post.subject_unit_id`)
				: sql`filter_post.subject_unit_id is null`,
		);
	if (filter.explainsRealmTag)
		conditions.push(sql`exists (
			select 1
			from realm_tag_context filter_realm_tag_context
			join unit filter_context_realm
				on filter_context_realm.id = filter_realm_tag_context.realm_id
			join unit filter_context_tag
				on filter_context_tag.id = filter_realm_tag_context.tag_id
			where filter_realm_tag_context.context_post_id = filter_post.id
				and ${unitReferenceCondition(
					filter.explainsRealmTag.realm,
					sql`filter_realm_tag_context.realm_id`,
					sql`filter_context_realm.kind`,
				)}
				and ${
					filter.explainsRealmTag.tag
						? unitReferenceCondition(
								filter.explainsRealmTag.tag,
								sql`filter_realm_tag_context.tag_id`,
								sql`filter_context_tag.kind`,
							)
						: sql`true`
				}
		)`);
	const displayed = filter.scores?.displayed;
	if (displayed) {
		const displayedFilter = "some" in displayed ? displayed.some : displayed.none;
		const exists = sql`exists (
			select 1
			from post_score filter_post_score
			join score filter_score on filter_score.id = filter_post_score.score_id
			join profile_preference filter_score_preference
				on filter_score_preference.profile_id = filter_score.profile_id
			join unit filter_score_realm on filter_score_realm.id = filter_score.realm_id
			join unit filter_score_target on filter_score_target.id = filter_score.unit_id
			where filter_post_score.post_id = filter_post.id
				and (
					${viewerProfileId ? sql`filter_score.profile_id = ${viewerProfileId}::uuid` : sql`false`}
					or (
						filter_score_preference.score_visibility <> 'private'
						and filter_score.visibility <> 'private'
						and filter_score_realm.status = 'published'
						and filter_score_realm.visibility in ('public', 'unlisted')
						and filter_score_realm.moderation_status = 'approved'
						and filter_score_realm.deleted_at is null
						and filter_score_target.status = 'published'
						and filter_score_target.visibility in ('public', 'unlisted')
						and filter_score_target.moderation_status = 'approved'
						and filter_score_target.deleted_at is null
						and ${
							viewerProfileId
								? sql`not exists (
										select 1 from profile_block filter_score_block
										where (
											filter_score_block.blocker_profile_id = ${viewerProfileId}::uuid
											and filter_score_block.blocked_profile_id = filter_score.profile_id
										) or (
											filter_score_block.blocker_profile_id = filter_score.profile_id
											and filter_score_block.blocked_profile_id = ${viewerProfileId}::uuid
										)
									)`
								: sql`true`
						}
					)
				)
				and ${scoreCondition(
					displayedFilter,
					{
						value: sql`filter_score.value`,
						realmId: sql`filter_score.realm_id`,
						realmKind: sql`filter_score_realm.kind`,
						targetId: sql`filter_score.unit_id`,
						targetKind: sql`filter_score_target.kind`,
						authorId: sql`filter_score.profile_id`,
					},
					viewerProfileId,
				)}
		)`;
		conditions.push("some" in displayed ? exists : sql`not (${exists})`);
	}
	return conjunction(conditions);
}

function collectionCondition(filter: CollectionFilter): SQL {
	const conditions = logicConditions(filter, collectionCondition);
	if (filter.items) {
		const relation = filter.items;
		const itemFilter = "some" in relation ? relation.some : relation.none;
		const exists = sql`exists (
			select 1
			from collection_item filter_collection_item
			join unit filter_collection_item_unit
				on filter_collection_item_unit.id = filter_collection_item.unit_id
			where filter_collection_item.collection_id = filter_collection.id
				and ${unitReferenceCondition(
					itemFilter,
					sql`filter_collection_item_unit.id`,
					sql`filter_collection_item_unit.kind`,
				)}
		)`;
		conditions.push("some" in relation ? exists : sql`not (${exists})`);
	}
	return conjunction(conditions);
}

export interface CompileUnitPredicateSqlInput {
	readonly unitId: SQL<unknown>;
	readonly unitKind: SQL<unknown>;
	readonly viewerProfileId?: string;
}

function combineCandidateSets(
	sets: readonly SQL[],
	operator: "intersect" | "union",
): SQL | undefined {
	if (!sets.length) return undefined;
	if (sets.length === 1) return sets[0];
	// Every positive conjunct is independently a safe superset seed. Choosing one keeps the
	// reverse-index probe streaming; INTERSECT would have to materialize every matching relation
	// before an outer LIMIT could stop it. Disjunctions need every branch, but UNION ALL preserves
	// streaming too. The bounded seed probe deduplicates the resulting UUIDs in memory.
	if (operator === "intersect") return sets[0];
	return sql`${sql.join(
		sets.map((set) => sql`(${set})`),
		sql` union all `,
	)}`;
}

function realmPlacementCandidateSet(filter: RealmPlacementFilter): SQL | undefined {
	const conjunctiveSets: SQL[] = [];
	if (filter.all) {
		const allSet = combineCandidateSets(
			filter.all.flatMap((child) => {
				const childSet = realmPlacementCandidateSet(child);
				return childSet ? [childSet] : [];
			}),
			"intersect",
		);
		if (allSet) conjunctiveSets.push(allSet);
	}
	if (filter.any) {
		const childSets = filter.any.map(realmPlacementCandidateSet);
		if (childSets.every((set): set is SQL => set !== undefined)) {
			const anySet = combineCandidateSets(childSets, "union");
			if (anySet) conjunctiveSets.push(anySet);
		}
	}
	if (filter.realm?.id)
		conjunctiveSets.push(sql`select filter_realm_unit.unit_id
			from realm_unit filter_realm_unit
			join unit filter_realm on filter_realm.id = filter_realm_unit.realm_id
			where ${realmPlacementCondition(filter)}`);
	return combineCandidateSets(conjunctiveSets, "intersect");
}

function tagAssertionCandidateSet(
	filter: TagAssertionFilter,
	viewerProfileId?: string,
): SQL | undefined {
	const conjunctiveSets: SQL[] = [];
	if (filter.all) {
		const allSet = combineCandidateSets(
			filter.all.flatMap((child) => {
				const childSet = tagAssertionCandidateSet(child, viewerProfileId);
				return childSet ? [childSet] : [];
			}),
			"intersect",
		);
		if (allSet) conjunctiveSets.push(allSet);
	}
	if (filter.any) {
		const childSets = filter.any.map((child) => tagAssertionCandidateSet(child, viewerProfileId));
		if (childSets.every((set): set is SQL => set !== undefined)) {
			const anySet = combineCandidateSets(childSets, "union");
			if (anySet) conjunctiveSets.push(anySet);
		}
	}
	const authority = filter.authority;
	const tagIds = filter.tag?.id?.in;
	if (!authority || (authority.kind === "global" && authority.view.kind === "effective")) {
		if (tagIds)
			conjunctiveSets.push(sql`select filter_effective_tag.unit_id
				from ${currentUnitEffectiveTag} filter_effective_tag
				where ${valuesCondition(sql`filter_effective_tag.tag_id`, tagIds, true)}`);
	} else if (authority.kind === "global") {
		if (tagIds)
			conjunctiveSets.push(sql`select filter_unit_tag.unit_id
				from unit_tag filter_unit_tag
				where ${valuesCondition(sql`filter_unit_tag.tag_id`, tagIds, true)}`);
	} else if (authority.kind === "realm" && authority.view.kind === "policy") {
		const realmIds = authority.realm.id?.in;
		if (realmIds || tagIds)
			conjunctiveSets.push(sql`select filter_realm_tag.unit_id
				from realm_unit_tag filter_realm_tag
				where ${conjunction([
					realmIds ? valuesCondition(sql`filter_realm_tag.realm_id`, realmIds, true) : sql`true`,
					tagIds ? valuesCondition(sql`filter_realm_tag.tag_id`, tagIds, true) : sql`true`,
				])}`);
	} else if (authority.kind === "realm") {
		const realmIds = authority.realm.id?.in;
		if (realmIds || tagIds)
			conjunctiveSets.push(sql`select filter_realm_tag_stat.unit_id
				from realm_tag_judgment_stat filter_realm_tag_stat
				where ${conjunction([
					sql`filter_realm_tag_stat.vote_count > 0`,
					realmIds
						? valuesCondition(sql`filter_realm_tag_stat.realm_id`, realmIds, true)
						: sql`true`,
					tagIds ? valuesCondition(sql`filter_realm_tag_stat.tag_id`, tagIds, true) : sql`true`,
				])}`);
	} else if (viewerProfileId) {
		conjunctiveSets.push(sql`select filter_profile_tag.unit_id
			from profile_unit_tag filter_profile_tag
			where filter_profile_tag.profile_id = ${viewerProfileId}::uuid
				and ${tagIds ? valuesCondition(sql`filter_profile_tag.tag_id`, tagIds, true) : sql`true`}`);
	}
	return combineCandidateSets(conjunctiveSets, "intersect");
}

function scoreCandidateSet(
	filter: ScoreFilter,
	viewerProfileId: string | undefined,
	target: "received" | "displayed",
): SQL | undefined {
	const conjunctiveSets: SQL[] = [];
	if (filter.all) {
		const allSet = combineCandidateSets(
			filter.all.flatMap((child) => {
				const childSet = scoreCandidateSet(child, viewerProfileId, target);
				return childSet ? [childSet] : [];
			}),
			"intersect",
		);
		if (allSet) conjunctiveSets.push(allSet);
	}
	if (filter.any) {
		const childSets = filter.any.map((child) => scoreCandidateSet(child, viewerProfileId, target));
		if (childSets.every((set): set is SQL => set !== undefined)) {
			const anySet = combineCandidateSets(childSets, "union");
			if (anySet) conjunctiveSets.push(anySet);
		}
	}
	const authorAnchored =
		filter.author?.kind === "viewer"
			? viewerProfileId !== undefined
			: filter.author?.id !== undefined;
	if (filter.realm?.id || filter.target?.id || authorAnchored) {
		const source = sql`from score filter_candidate_score
			join unit filter_candidate_score_realm
				on filter_candidate_score_realm.id = filter_candidate_score.realm_id
			join unit filter_candidate_score_target
				on filter_candidate_score_target.id = filter_candidate_score.unit_id`;
		const condition = scoreCondition(
			filter,
			{
				value: sql`filter_candidate_score.value`,
				realmId: sql`filter_candidate_score.realm_id`,
				realmKind: sql`filter_candidate_score_realm.kind`,
				targetId: sql`filter_candidate_score.unit_id`,
				targetKind: sql`filter_candidate_score_target.kind`,
				authorId: sql`filter_candidate_score.profile_id`,
			},
			viewerProfileId,
		);
		conjunctiveSets.push(
			target === "received"
				? sql`select filter_candidate_score.unit_id as unit_id
					${source}
					where ${condition}`
				: sql`select filter_candidate_post_score.post_id as unit_id
					from post_score filter_candidate_post_score
					join score filter_candidate_score
						on filter_candidate_score.id = filter_candidate_post_score.score_id
					join unit filter_candidate_score_realm
						on filter_candidate_score_realm.id = filter_candidate_score.realm_id
					join unit filter_candidate_score_target
						on filter_candidate_score_target.id = filter_candidate_score.unit_id
					where ${condition}`,
		);
	}
	return combineCandidateSets(conjunctiveSets, "intersect");
}

function postCandidateSet(filter: PostFilter, viewerProfileId?: string): SQL | undefined {
	const conjunctiveSets: SQL[] = [];
	if (filter.all) {
		const allSet = combineCandidateSets(
			filter.all.flatMap((child) => {
				const childSet = postCandidateSet(child, viewerProfileId);
				return childSet ? [childSet] : [];
			}),
			"intersect",
		);
		if (allSet) conjunctiveSets.push(allSet);
	}
	if (filter.any) {
		const childSets = filter.any.map((child) => postCandidateSet(child, viewerProfileId));
		if (childSets.every((set): set is SQL => set !== undefined)) {
			const anySet = combineCandidateSets(childSets, "union");
			if (anySet) conjunctiveSets.push(anySet);
		}
	}
	if (filter.subject && "is" in filter.subject && filter.subject.is.id)
		conjunctiveSets.push(sql`select filter_candidate_post.id as unit_id
			from post filter_candidate_post
			where ${valuesCondition(
				sql`filter_candidate_post.subject_unit_id`,
				filter.subject.is.id.in,
				true,
			)}`);
	if (filter.explainsRealmTag) {
		const realmIds = filter.explainsRealmTag.realm.id?.in;
		const tagIds = filter.explainsRealmTag.tag?.id?.in;
		if (realmIds || tagIds)
			conjunctiveSets.push(sql`select filter_candidate_context.context_post_id as unit_id
				from realm_tag_context filter_candidate_context
				where ${conjunction([
					realmIds
						? valuesCondition(sql`filter_candidate_context.realm_id`, realmIds, true)
						: sql`true`,
					tagIds ? valuesCondition(sql`filter_candidate_context.tag_id`, tagIds, true) : sql`true`,
				])}`);
	}
	const displayed = filter.scores?.displayed;
	if (displayed && "some" in displayed) {
		const displayedSet = scoreCandidateSet(displayed.some, viewerProfileId, "displayed");
		if (displayedSet) conjunctiveSets.push(displayedSet);
	}
	return combineCandidateSets(conjunctiveSets, "intersect");
}

function collectionCandidateSet(filter: CollectionFilter): SQL | undefined {
	const conjunctiveSets: SQL[] = [];
	if (filter.all) {
		const allSet = combineCandidateSets(
			filter.all.flatMap((child) => {
				const childSet = collectionCandidateSet(child);
				return childSet ? [childSet] : [];
			}),
			"intersect",
		);
		if (allSet) conjunctiveSets.push(allSet);
	}
	if (filter.any) {
		const childSets = filter.any.map(collectionCandidateSet);
		if (childSets.every((set): set is SQL => set !== undefined)) {
			const anySet = combineCandidateSets(childSets, "union");
			if (anySet) conjunctiveSets.push(anySet);
		}
	}
	if (filter.items && "some" in filter.items && filter.items.some.id)
		conjunctiveSets.push(sql`select filter_candidate_collection_item.collection_id as unit_id
			from collection_item filter_candidate_collection_item
			where ${valuesCondition(
				sql`filter_candidate_collection_item.unit_id`,
				filter.items.some.id.in,
				true,
			)}`);
	return combineCandidateSets(conjunctiveSets, "intersect");
}

/**
 * Returns an indexed, positive candidate set that is guaranteed to contain every matching Unit.
 * Unsupported or negative clauses are deliberately omitted; the complete predicate is always
 * reapplied after ordering, so this optimization can widen a seed but can never widen results.
 */
export function compileUnitPredicateCandidateSet(
	filter: UnitPredicate,
	viewerProfileId?: string,
): SQL | undefined {
	const conjunctiveSets: SQL[] = [];
	if (filter.all) {
		const allSet = combineCandidateSets(
			filter.all.flatMap((child) => {
				const childSet = compileUnitPredicateCandidateSet(child, viewerProfileId);
				return childSet ? [childSet] : [];
			}),
			"intersect",
		);
		if (allSet) conjunctiveSets.push(allSet);
	}
	if (filter.any) {
		const childSets = filter.any.map((child) =>
			compileUnitPredicateCandidateSet(child, viewerProfileId),
		);
		if (childSets.every((set): set is SQL => set !== undefined)) {
			const anySet = combineCandidateSets(childSets, "union");
			if (anySet) conjunctiveSets.push(anySet);
		}
	}
	if (filter.id)
		conjunctiveSets.push(sql`select candidate_unit.id as unit_id
			from unit candidate_unit
			where ${valuesCondition(sql`candidate_unit.id`, filter.id.in, true)}`);
	if (filter.contentLanguageSupport && "some" in filter.contentLanguageSupport)
		conjunctiveSets.push(sql`select filter_content_language.unit_id
			from unit_content_language_search filter_content_language
			where ${contentLanguageSupportCondition(filter.contentLanguageSupport.some)}`);
	if (filter.realms && "some" in filter.realms) {
		const realmSet = realmPlacementCandidateSet(filter.realms.some);
		if (realmSet) conjunctiveSets.push(realmSet);
	}
	if (
		filter.creditAttributions &&
		"some" in filter.creditAttributions &&
		filter.creditAttributions.some.id
	)
		conjunctiveSets.push(sql`select filter_credit_attribution.source_unit_id as unit_id
			from credit_attribution filter_credit_attribution
			join unit filter_credited_unit
				on filter_credited_unit.id = filter_credit_attribution.credited_unit_id
			where ${unitReferenceCondition(
				filter.creditAttributions.some,
				sql`filter_credited_unit.id`,
				sql`filter_credited_unit.kind`,
			)}`);
	if (
		filter.subjectAssociations &&
		"some" in filter.subjectAssociations &&
		filter.subjectAssociations.some.id
	)
		conjunctiveSets.push(sql`select filter_subject_association.unit_id
			from subject_association filter_subject_association
			join unit filter_subject_entity
				on filter_subject_entity.id = filter_subject_association.entity_id
			where ${unitReferenceCondition(
				filter.subjectAssociations.some,
				sql`filter_subject_entity.id`,
				sql`filter_subject_entity.kind`,
			)}`);
	if (filter.publishers && "some" in filter.publishers)
		conjunctiveSets.push(sql`select filter_publisher.source_unit_id as unit_id
			from credit_attribution filter_publisher
			where filter_publisher.role = 'publisher'
				and ${profileReferenceCondition(
					filter.publishers.some,
					sql`filter_publisher.credited_unit_id`,
					viewerProfileId,
				)}`);
	if (filter.tags && "some" in filter.tags) {
		const tagSet = tagAssertionCandidateSet(filter.tags.some, viewerProfileId);
		if (tagSet) conjunctiveSets.push(tagSet);
	}
	if (filter.scores?.received && "some" in filter.scores.received) {
		const scoreSet = scoreCandidateSet(filter.scores.received.some, viewerProfileId, "received");
		if (scoreSet) conjunctiveSets.push(scoreSet);
	}
	if (filter.post && "is" in filter.post) {
		const postSet = postCandidateSet(filter.post.is, viewerProfileId);
		if (postSet) conjunctiveSets.push(postSet);
	}
	if (filter.collection && "is" in filter.collection) {
		const collectionSet = collectionCandidateSet(filter.collection.is);
		if (collectionSet) conjunctiveSets.push(collectionSet);
	}
	return combineCandidateSets(conjunctiveSets, "intersect");
}

/** Compiles a validated domain Filter to a parameterized Feed eligibility predicate. */
export function compileUnitPredicateSql(
	filter: UnitPredicate,
	input: CompileUnitPredicateSqlInput,
): SQL {
	const conditions = logicConditions(filter, (child) => compileUnitPredicateSql(child, input));
	if (filter.id) conditions.push(valuesCondition(input.unitId, filter.id.in, true));
	if (filter.kind) conditions.push(valuesCondition(input.unitKind, filter.kind.in));
	if (filter.localizations) {
		const relation = filter.localizations;
		const exists = sql`exists (
			select 1 from unit_localization filter_localization
			where filter_localization.unit_id = ${input.unitId}
				and ${localizationCondition("some" in relation ? relation.some : relation.none)}
		)`;
		conditions.push("some" in relation ? exists : sql`not (${exists})`);
	}
	if (filter.contentLanguageSupport) {
		const relation = filter.contentLanguageSupport;
		const exists = sql`exists (
			select 1 from unit_content_language_search filter_content_language
			where filter_content_language.unit_id = ${input.unitId}
				and ${contentLanguageSupportCondition("some" in relation ? relation.some : relation.none)}
		)`;
		conditions.push("some" in relation ? exists : sql`not (${exists})`);
	}
	if (filter.realms) {
		const relation = filter.realms;
		const exists = sql`exists (
			select 1
			from realm_unit filter_realm_unit
			join unit filter_realm on filter_realm.id = filter_realm_unit.realm_id
			where filter_realm_unit.unit_id = ${input.unitId}
				and ${realmPlacementCondition("some" in relation ? relation.some : relation.none)}
		)`;
		conditions.push("some" in relation ? exists : sql`not (${exists})`);
	}
	if (filter.tags) {
		const relation = filter.tags;
		const condition = tagAssertionCondition(
			"some" in relation ? relation.some : relation.none,
			input.unitId,
			input.viewerProfileId,
		);
		conditions.push("some" in relation ? condition : sql`not (${condition})`);
	}
	if (filter.creditAttributions) {
		const relation = filter.creditAttributions;
		const reference = "some" in relation ? relation.some : relation.none;
		const membership = sql`${input.unitId} in (
			select filter_credit_attribution.source_unit_id
			from credit_attribution filter_credit_attribution
			join unit filter_credited_unit
				on filter_credited_unit.id = filter_credit_attribution.credited_unit_id
			where ${unitReferenceCondition(
				reference,
				sql`filter_credited_unit.id`,
				sql`filter_credited_unit.kind`,
			)}
		)`;
		conditions.push("some" in relation ? membership : sql`not (${membership})`);
	}
	if (filter.subjectAssociations) {
		const relation = filter.subjectAssociations;
		const reference = "some" in relation ? relation.some : relation.none;
		const membership = sql`${input.unitId} in (
			select filter_subject_association.unit_id
			from subject_association filter_subject_association
			join unit filter_subject_entity
				on filter_subject_entity.id = filter_subject_association.entity_id
			where ${unitReferenceCondition(
				reference,
				sql`filter_subject_entity.id`,
				sql`filter_subject_entity.kind`,
			)}
		)`;
		conditions.push("some" in relation ? membership : sql`not (${membership})`);
	}
	if (filter.publishers) {
		const relation = filter.publishers;
		const publisherFilter = "some" in relation ? relation.some : relation.none;
		const exists = sql`exists (
			select 1
			from credit_attribution filter_publisher
			where filter_publisher.source_unit_id = ${input.unitId}
				and filter_publisher.role = 'publisher'
				and ${profileReferenceCondition(
					publisherFilter,
					sql`filter_publisher.credited_unit_id`,
					input.viewerProfileId,
				)}
		)`;
		conditions.push("some" in relation ? exists : sql`not (${exists})`);
	}
	if (filter.scores?.received) {
		const relation = filter.scores.received;
		const exists = sql`exists (
			select 1
			from score filter_received_score
			join profile_preference filter_received_score_preference
				on filter_received_score_preference.profile_id = filter_received_score.profile_id
			join unit filter_received_realm
				on filter_received_realm.id = filter_received_score.realm_id
			join unit filter_received_target
				on filter_received_target.id = filter_received_score.unit_id
			where filter_received_score.unit_id = ${input.unitId}
				and (
					${
						input.viewerProfileId
							? sql`filter_received_score.profile_id = ${input.viewerProfileId}::uuid`
							: sql`false`
					}
					or (
						filter_received_score_preference.score_visibility = 'public'
						and filter_received_score.visibility = 'public'
						and filter_received_realm.status = 'published'
						and filter_received_realm.visibility = 'public'
						and filter_received_realm.moderation_status = 'approved'
						and filter_received_realm.deleted_at is null
						and filter_received_target.status = 'published'
						and filter_received_target.visibility = 'public'
						and filter_received_target.moderation_status = 'approved'
						and filter_received_target.deleted_at is null
						and ${
							input.viewerProfileId
								? sql`not exists (
										select 1 from profile_block filter_received_score_block
										where (
											filter_received_score_block.blocker_profile_id = ${input.viewerProfileId}::uuid
											and filter_received_score_block.blocked_profile_id = filter_received_score.profile_id
										) or (
											filter_received_score_block.blocker_profile_id = filter_received_score.profile_id
											and filter_received_score_block.blocked_profile_id = ${input.viewerProfileId}::uuid
										)
									)`
								: sql`true`
						}
					)
				)
				and ${scoreCondition(
					"some" in relation ? relation.some : relation.none,
					{
						value: sql`filter_received_score.value`,
						realmId: sql`filter_received_score.realm_id`,
						realmKind: sql`filter_received_realm.kind`,
						targetId: sql`filter_received_score.unit_id`,
						targetKind: sql`filter_received_target.kind`,
						authorId: sql`filter_received_score.profile_id`,
					},
					input.viewerProfileId,
				)}
		)`;
		conditions.push("some" in relation ? exists : sql`not (${exists})`);
	}
	if (filter.post)
		conditions.push(
			"is" in filter.post
				? sql`exists (
					select 1 from post filter_post
					where filter_post.id = ${input.unitId}
						and ${postCondition(filter.post.is, input.viewerProfileId)}
				)`
				: sql`not exists (select 1 from post filter_post where filter_post.id = ${input.unitId})`,
		);
	if (filter.collection)
		conditions.push(
			"is" in filter.collection
				? sql`exists (
					select 1 from collection filter_collection
					where filter_collection.id = ${input.unitId}
						and ${collectionCondition(filter.collection.is)}
				)`
				: sql`not exists (
					select 1 from collection filter_collection
					where filter_collection.id = ${input.unitId}
				)`,
		);
	return conjunction(conditions);
}
