import type {
	CollectionFilter,
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

function realmPlacementCondition(filter: RealmPlacementFilter): SQL {
	const conditions = logicConditions(filter, realmPlacementCondition);
	if (filter.realm)
		conditions.push(
			unitReferenceCondition(
				filter.realm,
				sql`filter_realm_unit.realm_id`,
				sql`filter_realm.kind`,
			),
		);
	if (filter.status)
		conditions.push(valuesCondition(sql`filter_realm_unit.status`, filter.status.in));
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
			from unit_effective_tag filter_effective_tag
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
			from unit_effective_tag filter_effective_tag
			join unit filter_tag on filter_tag.id = filter_effective_tag.tag_id
			${
				consensus
					? sql`join unit_tag_vote_stat filter_tag_stat
						on filter_tag_stat.unit_id = filter_effective_tag.unit_id
						and filter_tag_stat.tag_id = filter_effective_tag.tag_id`
					: sql``
			}
			where filter_effective_tag.unit_id = ${unitId}
				and ${tagReference(sql`filter_effective_tag.tag_id`, sql`filter_tag.kind`)}
				${
					consensus
						? sql`and ${voteSummaryCondition(
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
			from realm_tag_vote_stat filter_realm_tag_stat
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
		conditions.push(
			unitReferenceCondition(filter.target, columns.targetId, columns.targetKind),
		);
	if (filter.author)
		conditions.push(
			profileReferenceCondition(filter.author, columns.authorId, viewerProfileId),
		);
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
