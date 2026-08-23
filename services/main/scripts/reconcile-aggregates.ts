import { sql, type SQL } from "drizzle-orm";

import { database } from "../src/services/database";
import { parseAggregateDriftCount } from "./reconcile-aggregates-result";

const checks: readonly { name: string; query: SQL }[] = [
	{
		name: "score_stat",
		query: sql`
			with expected as (
				select unit_id, realm_id, count(*) as total_count, sum(value) as total_score,
					count(*) filter (where value = 1) as score_1_count,
					count(*) filter (where value = 2) as score_2_count,
					count(*) filter (where value = 3) as score_3_count,
					count(*) filter (where value = 4) as score_4_count,
					count(*) filter (where value = 5) as score_5_count,
					count(*) filter (where value = 6) as score_6_count,
					count(*) filter (where value = 7) as score_7_count,
					count(*) filter (where value = 8) as score_8_count,
					count(*) filter (where value = 9) as score_9_count,
					count(*) filter (where value = 10) as score_10_count
				from score group by unit_id, realm_id
			)
			select count(*)::text as drift_count from expected
			full join score_stat using (unit_id, realm_id)
			where expected.unit_id is null or score_stat.unit_id is null
				or row(expected.total_count, expected.total_score, expected.score_1_count,
					expected.score_2_count, expected.score_3_count, expected.score_4_count,
					expected.score_5_count, expected.score_6_count, expected.score_7_count,
					expected.score_8_count, expected.score_9_count, expected.score_10_count)
				is distinct from
				row(score_stat.total_count, score_stat.total_score, score_stat.score_1_count,
					score_stat.score_2_count, score_stat.score_3_count, score_stat.score_4_count,
					score_stat.score_5_count, score_stat.score_6_count, score_stat.score_7_count,
					score_stat.score_8_count, score_stat.score_9_count, score_stat.score_10_count)
		`,
	},
	{
		name: "vote_stats",
		query: sql`
			with expected as (
				select 'alias'::text as kind, alias_id::text as identity, sum(value) as score,
					count(*) as vote_count from unit_alias_vote group by alias_id
				union all
				select 'external_link', external_link_id::text, sum(value), count(*)
				from unit_external_link_vote group by external_link_id
				union all
				select 'unit_structure', structure_id::text, sum(value), count(*)
				from unit_structure_vote group by structure_id
			), actual as (
				select 'alias'::text as kind, alias_id::text as identity, score, vote_count
				from unit_alias_vote_stat
				union all
				select 'external_link', external_link_id::text, score, vote_count
				from unit_external_link_vote_stat
				union all
				select 'unit_structure', structure_id::text, score, vote_count
				from unit_structure_vote_stat
			)
			select count(*)::text as drift_count from expected
			full join actual using (kind, identity)
			where expected.identity is null or actual.identity is null
				or (expected.score, expected.vote_count) is distinct from
					(actual.score, actual.vote_count)
		`,
	},
	{
		name: "unit_follow_stat",
		query: sql`
			with expected as (select unit_id, count(*) as follower_count from unit_follow group by unit_id)
			select count(*)::text as drift_count from expected
			full join unit_follow_stat using (unit_id)
			where expected.unit_id is null or unit_follow_stat.unit_id is null
				or expected.follower_count is distinct from unit_follow_stat.follower_count
		`,
	},
	{
		name: "unit_reaction_stats",
		query: sql`
			with scoped_expected as (
				select unit_id, realm_id, reaction, count(*) as reaction_count
				from unit_reaction group by unit_id, realm_id, reaction
			), scoped_drift as (
				select 1 from scoped_expected expected
				full join unit_reaction_stat actual
					on actual.unit_id = expected.unit_id
					and actual.realm_id is not distinct from expected.realm_id
					and actual.reaction = expected.reaction
				where expected.unit_id is null or actual.unit_id is null
					or expected.reaction_count is distinct from actual.reaction_count
			), global_expected as (
				select unit_id, reaction, count(*) as reaction_count
				from unit_reaction group by unit_id, reaction
			), global_drift as (
				select 1 from global_expected
				full join unit_reaction_global_stat using (unit_id, reaction)
				where global_expected.unit_id is null or unit_reaction_global_stat.unit_id is null
					or global_expected.reaction_count is distinct from
						unit_reaction_global_stat.reaction_count
			)
			select ((select count(*) from scoped_drift) +
				(select count(*) from global_drift))::text as drift_count
		`,
	},
	{
		name: "post_reply_stat",
		query: sql`
			with expected as (
				select target.id as post_id,
					count(*) filter (where reply.parent_post_id = target.id
						and reply_unit.deleted_at is null) as undeleted_direct_count,
					count(*) filter (where reply.root_post_id = target.id
						and reply_unit.deleted_at is null) as undeleted_descendant_count,
					count(*) filter (where reply.parent_post_id = target.id
						and reply_unit.deleted_at is null and reply_unit.status = 'published'
						and reply_unit.visibility = 'public'
						and reply_unit.moderation_status = 'approved') as visible_direct_count,
					count(*) filter (where reply.root_post_id = target.id
						and reply_unit.deleted_at is null and reply_unit.status = 'published'
						and reply_unit.visibility = 'public'
						and reply_unit.moderation_status = 'approved') as visible_descendant_count
				from post target
				left join post_reply reply on reply.parent_post_id = target.id or reply.root_post_id = target.id
				left join unit reply_unit on reply_unit.id = reply.post_id
				group by target.id
			)
			select count(*)::text as drift_count from expected
			full join post_reply_stat using (post_id)
			where expected.post_id is null or post_reply_stat.post_id is null
				or row(expected.undeleted_direct_count, expected.undeleted_descendant_count,
					expected.visible_direct_count, expected.visible_descendant_count)
				is distinct from row(post_reply_stat.undeleted_direct_count,
					post_reply_stat.undeleted_descendant_count, post_reply_stat.visible_direct_count,
					post_reply_stat.visible_descendant_count)
		`,
	},
	{
		name: "collection_stat",
		query: sql`
			with expected as (
				select collection.id as collection_id, count(collection_item.unit_id) as item_count
				from collection
				left join collection_item on collection_item.collection_id = collection.id
				group by collection.id
			)
			select count(*)::text as drift_count from expected
			full join collection_stat using (collection_id)
			where expected.collection_id is null or collection_stat.collection_id is null
				or expected.item_count is distinct from collection_stat.item_count
		`,
	},
	{
		name: "poll_option_vote_stat",
		query: sql`
			with expected as (
				select poll_option.id as option_id, count(poll_vote.option_id) as vote_count
				from poll_option
				left join poll_vote on poll_vote.option_id = poll_option.id
				group by poll_option.id
			)
			select count(*)::text as drift_count from expected
			full join poll_option_vote_stat using (option_id)
			where expected.option_id is null or poll_option_vote_stat.option_id is null
				or expected.vote_count is distinct from poll_option_vote_stat.vote_count
		`,
	},
	{
		name: "realm_stat",
		query: sql`
			with expected as (
				select realm.id as realm_id,
					count(realm_member.profile_id) filter (where realm_member.state = 'active')
						as active_member_count
				from realm left join realm_member on realm_member.realm_id = realm.id
				group by realm.id
			)
			select count(*)::text as drift_count from expected
			full join realm_stat using (realm_id)
			where expected.realm_id is null or realm_stat.realm_id is null
				or expected.active_member_count is distinct from realm_stat.active_member_count
		`,
	},
	{
		name: "content_review_case_report_counter",
		query: sql`
			with expected as (
				select case_id, count(*) as report_count
				from content_report_referral
				group by case_id
			), actual as (
				select case_id, sum(count) as report_count
				from content_review_case_report_counter
				group by case_id
			)
			select count(*)::text as drift_count from expected
			full join actual using (case_id)
			where expected.case_id is null or actual.case_id is null
				or expected.report_count is distinct from actual.report_count
		`,
	},
	{
		name: "book_chapter_stats",
		query: sql`
			with eligible as (
				select node.id as node_id, structure.owner_unit_id as book_unit_id,
					content_unit.status = 'published'
						and content_unit.visibility in ('public', 'unlisted') as public_eligible
				from content_structure_node node
				join content_structure structure on structure.id = node.structure_id
				join unit content_unit on content_unit.id = node.content_unit_id
				join post content_post on content_post.id = content_unit.id
				where structure.kind = 'book.contents' and structure.deleted_at is null
					and node.deleted_at is null and content_unit.kind = 'post'
					and content_unit.deleted_at is null and content_post.kind = 'chapter'
			), expected_book as (
				select book_unit_id, count(*) as all_count,
					count(*) filter (where public_eligible) as public_count
				from eligible group by book_unit_id
			), book_drift as (
				select 1 from expected_book
				full join book_chapter_stat using (book_unit_id)
				where coalesce(expected_book.all_count, 0) is distinct from
					coalesce(book_chapter_stat.all_count, 0)
					or coalesce(expected_book.public_count, 0) is distinct from
						coalesce(book_chapter_stat.public_count, 0)
			), expected_progress as (
				select progress.profile_id, eligible.book_unit_id,
					count(*) as all_completed_count,
					count(*) filter (where eligible.public_eligible) as public_completed_count
				from eligible
				join content_structure_node_progress progress on progress.node_id = eligible.node_id
				group by progress.profile_id, eligible.book_unit_id
			), progress_drift as (
				select 1 from expected_progress
				full join book_chapter_progress_stat using (profile_id, book_unit_id)
				where coalesce(expected_progress.all_completed_count, 0) is distinct from
					coalesce(book_chapter_progress_stat.all_completed_count, 0)
					or coalesce(expected_progress.public_completed_count, 0) is distinct from
						coalesce(book_chapter_progress_stat.public_completed_count, 0)
			)
			select ((select count(*) from book_drift) +
				(select count(*) from progress_drift))::text as drift_count
		`,
	},
	{
		name: "book_localized_content_metric_stat",
		query: sql`
			with expected as (
				select structure.owner_unit_id as book_unit_id, metric.language,
					count(*) as chapter_count, sum(metric.word_count) as word_count,
					sum(metric.character_count) as character_count
				from content_structure_node node
				join content_structure structure on structure.id = node.structure_id
					and structure.owner_unit_id = node.owner_unit_id
				join post content_post on content_post.id = node.content_unit_id
				join unit content_unit on content_unit.id = node.content_unit_id
				join unit_localization localization on localization.unit_id = node.content_unit_id
				join unit_localization_content_metric metric
					on metric.unit_id = node.content_unit_id
					and metric.language = localization.language
				where structure.kind = 'book.contents' and structure.deleted_at is null
					and node.deleted_at is null and content_post.kind = 'chapter'
					and content_unit.deleted_at is null and content_unit.status = 'published'
					and content_unit.visibility in ('public', 'unlisted')
					and localization.content_status = 'published'
				group by structure.owner_unit_id, metric.language
			)
			select count(*)::text as drift_count from expected
			full join book_localized_content_metric_stat using (book_unit_id, language)
			where expected.book_unit_id is null
				or book_localized_content_metric_stat.book_unit_id is null
				or row(expected.chapter_count, expected.word_count, expected.character_count)
					is distinct from row(
						book_localized_content_metric_stat.chapter_count,
						book_localized_content_metric_stat.word_count,
						book_localized_content_metric_stat.character_count
					)
		`,
	},
	{
		name: "unit_engagement_stat",
		query: sql`
			with change as (
				select unit_id,
					count(*) filter (where reaction = 'upvote') as upvotes,
					count(*) filter (where reaction = 'downvote') as downvotes,
					0::bigint as replies, 0::bigint as favorites, 0::bigint as shares,
					0::bigint as high_scores, 0::bigint as active_progress,
					0::bigint as completions, 0::bigint as negative_progress
				from unit_reaction group by unit_id
				union all
				select target_id, 0, 0, count(*), 0, 0, 0, 0, 0, 0 from (
					select reply.root_post_id as target_id
					from post_reply reply join unit reply_unit on reply_unit.id = reply.post_id
					where reply_unit.deleted_at is null
					union all
					select reply.parent_post_id
					from post_reply reply join unit reply_unit on reply_unit.id = reply.post_id
					where reply.parent_post_id is not null and reply_unit.deleted_at is null
				) reply_target group by target_id
				union all
				select item.unit_id, 0, 0, 0, count(*), 0, 0, 0, 0, 0
				from collection_item item
				join profile_favorites_collection favorites
					on favorites.collection_id = item.collection_id
				group by item.unit_id
				union all
				select unit_id, 0, 0, 0, 0, count(*), 0, 0, 0, 0
				from unit_share group by unit_id
				union all
				select unit_id, 0, 0, 0, 0, 0,
					count(*) filter (where value >= 8), 0, 0, 0
				from score group by unit_id
				union all
				select unit_id, 0, 0, 0, 0, 0, 0,
					count(*) filter (where status = 'active'),
					count(*) filter (where status = 'completed'),
					count(*) filter (where status = 'dropped')
				from unit_progress where deleted_at is null group by unit_id
			), expected as (
				select unit_id, sum(upvotes) as upvotes, sum(downvotes) as downvotes,
					sum(replies) as replies, sum(favorites) as favorites, sum(shares) as shares,
					sum(high_scores) as high_scores, sum(active_progress) as active_progress,
					sum(completions) as completions, sum(negative_progress) as negative_progress
				from change group by unit_id
			)
			select count(*)::text as drift_count from expected
			full join unit_engagement_stat using (unit_id)
			where expected.unit_id is null or unit_engagement_stat.unit_id is null
				or row(expected.upvotes, expected.downvotes, expected.replies,
					expected.favorites, expected.shares, expected.high_scores,
					expected.active_progress, expected.completions,
					expected.negative_progress) is distinct from
					row(unit_engagement_stat.upvotes, unit_engagement_stat.downvotes,
						unit_engagement_stat.replies, unit_engagement_stat.favorites,
						unit_engagement_stat.shares, unit_engagement_stat.high_scores,
						unit_engagement_stat.active_progress, unit_engagement_stat.completions,
						unit_engagement_stat.negative_progress)
		`,
	},
	{
		name: "conversation_stats",
		query: sql`
			with conversation_expected as (
				select conversation.id as conversation_id, latest.id as last_message_id,
					latest.created_at as last_message_at
				from conversation left join lateral (
					select id, created_at from message where conversation_id = conversation.id
					order by created_at desc, id desc limit 1
				) latest on true
			), conversation_drift as (
				select 1 from conversation_expected
				full join conversation_stat using (conversation_id)
				where conversation_expected.conversation_id is null
					or conversation_stat.conversation_id is null
					or (conversation_expected.last_message_id, conversation_expected.last_message_at)
						is distinct from (conversation_stat.last_message_id,
							conversation_stat.last_message_at)
			), participant_expected as (
				select conversation.id as conversation_id, participant.profile_id,
					latest.id as last_message_id, latest.created_at as last_message_at,
					coalesce(latest.created_at, conversation.created_at) as sort_at
				from conversation
				cross join lateral (values (conversation.participant_low_profile_id),
					(conversation.participant_high_profile_id)) participant(profile_id)
				left join lateral (
					select id, created_at from message where conversation_id = conversation.id
					order by created_at desc, id desc limit 1
				) latest on true
			), participant_drift as (
				select 1 from participant_expected
				full join conversation_participant_stat using (conversation_id, profile_id)
				where participant_expected.conversation_id is null
					or conversation_participant_stat.conversation_id is null
					or row(participant_expected.last_message_id,
						participant_expected.last_message_at, participant_expected.sort_at) is distinct from
						row(conversation_participant_stat.last_message_id,
						conversation_participant_stat.last_message_at,
						conversation_participant_stat.sort_at)
			)
			select ((select count(*) from conversation_drift) +
				(select count(*) from participant_drift))::text as drift_count
		`,
	},
];

/** Unread counters are estimates; report their drift without failing reconciliation. */
const advisoryChecks: readonly { name: string; query: SQL }[] = [
	{
		name: "notification_unread_count",
		query: sql`
			with expected as (
				select profile.id as profile_id,
					count(notification.id) filter (
						where notification.in_app_visible and notification.read_at is null
							and (read_state.read_through_created_at is null
								or notification.created_at > read_state.read_through_created_at
								or (notification.created_at = read_state.read_through_created_at
									and notification.id > read_state.read_through_id))
					) as unread_count
				from profile
				left join notification_recipient_stat read_state
					on read_state.profile_id = profile.id
				left join notification on notification.recipient_profile_id = profile.id
				group by profile.id
			)
			select count(*)::text as drift_count from expected
			full join notification_recipient_stat using (profile_id)
			where expected.profile_id is null or notification_recipient_stat.profile_id is null
				or expected.unread_count is distinct from notification_recipient_stat.unread_count
		`,
	},
	{
		name: "conversation_unread_count",
		query: sql`
			with expected as (
				select conversation.id as conversation_id, participant.profile_id,
					count(unread.id) filter (where unread.id is not null) as unread_count
				from conversation
				cross join lateral (values (conversation.participant_low_profile_id),
					(conversation.participant_high_profile_id)) participant(profile_id)
				left join conversation_read read_state
					on read_state.conversation_id = conversation.id
					and read_state.profile_id = participant.profile_id
				left join message marker on marker.id = read_state.last_read_message_id
				left join message unread on unread.conversation_id = conversation.id
					and unread.sender_profile_id <> participant.profile_id
					and unread.deleted_at is null
					and (marker.id is null or (unread.created_at, unread.id) >
						(marker.created_at, marker.id))
				group by conversation.id, participant.profile_id
			)
			select count(*)::text as drift_count from expected
			full join conversation_participant_stat using (conversation_id, profile_id)
			where expected.conversation_id is null or conversation_participant_stat.conversation_id is null
				or expected.unread_count is distinct from conversation_participant_stat.unread_count
		`,
	},
];

console.info(
	"VNDB v11 judgment and effective-projection parity is owned by the paused-epoch bounded verifier in scripts/vndb-v11-cutover-verification.ts.",
);
try {
	let drifted = false;
	for (const check of checks) {
		const startedAt = performance.now();
		const result = await database.execute(check.query);
		const driftCount = parseAggregateDriftCount(result.rows, check.name);
		console.info(
			`${check.name}: ${driftCount} drifted rows (${Math.round(performance.now() - startedAt)} ms)`,
		);
		drifted ||= driftCount > 0;
	}
	for (const check of advisoryChecks) {
		const startedAt = performance.now();
		const result = await database.execute(check.query);
		const driftCount = parseAggregateDriftCount(result.rows, check.name);
		const message = `${check.name} (advisory): ${driftCount} drifted rows (${Math.round(performance.now() - startedAt)} ms)`;
		if (driftCount > 0) console.warn(message);
		else console.info(message);
	}
	if (drifted) throw new Error("Aggregate reconciliation found drift");
} finally {
	await database.$client.end();
}
