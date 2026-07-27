SELECT
	source.unit_id,
	source.revision,
	(
		unit_row.id IS NOT NULL
		AND category.value IS NOT NULL
		AND (unit_row.kind <> 'structure' OR structure_path.indexable)
	) AS indexable,
	CASE
		WHEN unit_row.id IS NULL
			OR category.value IS NULL
			OR (unit_row.kind = 'structure' AND NOT structure_path.indexable)
		THEN NULL
	ELSE jsonb_build_object(
		'id', source.unit_id,
		'projectionVersion', 6,
		'revision', source.revision,
		'category', category.value,
		'unitType', unit_row.kind,
		'searchKind', CASE category.value
			WHEN 'units' THEN unit_row.kind
			WHEN 'entity' THEN entity_row.kind
			WHEN 'posts' THEN post_row.kind::text
			WHEN 'reviews' THEN subject_unit_row.kind
			WHEN 'tag-structures' THEN structure_row.kind
			ELSE NULL
		END,
		'search', jsonb_build_object(
			'primaryTitles', CASE WHEN unit_row.kind = 'structure'
				THEN coalesce(structure_path.primary_titles, '[]'::jsonb)
				ELSE coalesce(localization.primary_titles, '[]'::jsonb) END,
			'titles', CASE WHEN unit_row.kind = 'structure'
				THEN coalesce(structure_path.titles, '[]'::jsonb)
				ELSE coalesce(localization.titles, '[]'::jsonb) END,
			'aliases', CASE WHEN unit_row.kind = 'structure'
				THEN coalesce(structure_path.aliases, '[]'::jsonb)
				ELSE coalesce(alias_data.aliases, '[]'::jsonb) END,
			'summaries', CASE WHEN unit_row.kind = 'structure'
				THEN coalesce(structure_path.summaries, '[]'::jsonb)
				ELSE coalesce(localization.summaries, '[]'::jsonb) END,
			'descriptions', CASE WHEN unit_row.kind = 'structure'
				THEN '[]'::jsonb
				ELSE coalesce(localization.descriptions, '[]'::jsonb) END,
			'publishedContent', CASE WHEN unit_row.kind = 'structure'
				THEN '[]'::jsonb
				ELSE coalesce(localization.published_content, '[]'::jsonb) END
		),
		'languages', CASE WHEN unit_row.kind = 'structure'
			THEN coalesce(structure_path.languages, '[]'::jsonb)
			ELSE coalesce(localization.languages, '[]'::jsonb) END,
		'filters', jsonb_build_object(
			'contentRating', unit_row.content_rating,
			'aiDisclosure', unit_row.ai_disclosure,
			'license', unit_row.license,
			'tagIds', coalesce(tag_data.tag_ids, '[]'::jsonb),
			'realmIds', coalesce(realm_data.realm_ids, '[]'::jsonb),
			'realmTagVoteKeys', coalesce(realm_tag_vote_data.keys, '[]'::jsonb),
			'creditedUnitIds', coalesce(attribution_data.credited_unit_ids, '[]'::jsonb),
			'subjectId', post_row.subject_unit_id,
			'rootId', reply_row.root_post_id,
			'parentId', reply_row.parent_post_id,
			'ownerProfileIds', coalesce(owner_data.profile_ids, '[]'::jsonb),
			'joinPolicy', realm_row.join_policy,
			'pollMode', poll_row.mode,
			'resultsVisibility', poll_row.result_visibility,
			'closesAt', CASE WHEN poll_row.closes_at IS NULL THEN NULL ELSE extract(epoch FROM poll_row.closes_at)::bigint END,
			'scopeOwnerIds', coalesce(scope_data.owner_ids, '[]'::jsonb)
		),
		'access', jsonb_build_object(
			'publicDiscoverable', unit_row.status = 'published' AND unit_row.visibility = 'public' AND unit_row.moderation_status = 'approved' AND unit_row.deleted_at IS NULL,
			'authenticated', coalesce(access_data.authenticated, false),
			'profileIds', coalesce(access_data.profile_ids, '[]'::jsonb),
			'realmIds', coalesce(access_data.realm_ids, '[]'::jsonb)
		),
		'catalog', jsonb_build_object(
			'licensed', catalog_license_row.unit_id IS NOT NULL,
			'releaseAt', CASE WHEN coalesce(media_row.release_date, software_row.release_date) IS NULL THEN NULL ELSE extract(epoch FROM coalesce(media_row.release_date, software_row.release_date)::timestamptz)::bigint END
		),
		'book', CASE WHEN unit_row.kind = 'book' THEN jsonb_build_object(
			'isbn13', book_row.isbn13,
			'publicationAt', CASE WHEN book_row.publication_date IS NULL THEN NULL ELSE extract(epoch FROM book_row.publication_date::timestamptz)::bigint END,
			'pageCount', book_row.page_count,
			'format', book_row.format
		) ELSE 'null'::jsonb END,
		'media', CASE WHEN unit_row.kind = 'media' THEN jsonb_build_object(
			'kind', media_row.kind,
			'releaseAt', CASE WHEN media_row.release_date IS NULL THEN NULL ELSE extract(epoch FROM media_row.release_date::timestamptz)::bigint END,
			'runtimeMinutes', media_row.runtime_minutes,
			'episodeCount', media_row.episode_count,
			'seasonCount', media_row.season_count
		) ELSE 'null'::jsonb END,
		'software', CASE WHEN unit_row.kind = 'software' THEN jsonb_build_object(
			'releaseAt', CASE WHEN software_row.release_date IS NULL THEN NULL ELSE extract(epoch FROM software_row.release_date::timestamptz)::bigint END,
			'versionLabel', software_row.version_label,
			'platformIds', coalesce(requirement_data.platform_ids, '[]'::jsonb),
			'requirementTiers', coalesce(requirement_data.tiers, '[]'::jsonb)
		) ELSE 'null'::jsonb END,
		'variant', jsonb_build_object(
			'role', CASE WHEN variant_row.variant_unit_id IS NOT NULL THEN 'variant' WHEN variant_children.has_variants THEN 'main' ELSE 'standalone' END,
			'mainUnitId', variant_row.main_unit_id
		),
		'ranking', jsonb_build_object(
			'createdAt', extract(epoch FROM unit_row.created_at)::bigint,
			'updatedAt', extract(epoch FROM unit_row.updated_at)::bigint,
			'publishedAt', CASE WHEN unit_row.published_at IS NULL THEN NULL ELSE extract(epoch FROM unit_row.published_at)::bigint END,
			'followerCount', coalesce(follow_stat.follower_count, 0),
			'replyCount', CASE WHEN post_row.kind = 'post' THEN coalesce(reply_stat.undeleted_descendant_count, 0) ELSE coalesce(reply_stat.undeleted_direct_count, 0) END,
			'recommendationSnapshotId', recommendation_data.snapshot_id,
			'recommendationBest', coalesce(recommendation_data.engagement_24h, 0),
			'engagement24h', coalesce(recommendation_data.engagement_24h, 0)
		)
	) END AS document
FROM public.search_unit_projection_source AS source
LEFT JOIN public.unit AS unit_row ON unit_row.id = source.unit_id
LEFT JOIN public.entity AS entity_row ON entity_row.id = source.unit_id
LEFT JOIN public.post AS post_row ON post_row.id = source.unit_id
LEFT JOIN public.unit AS subject_unit_row ON subject_unit_row.id = post_row.subject_unit_id
LEFT JOIN public.post_reply AS reply_row ON reply_row.post_id = source.unit_id
LEFT JOIN public.post_reply_stat AS reply_stat ON reply_stat.post_id = source.unit_id
LEFT JOIN public.realm AS realm_row ON realm_row.id = source.unit_id
LEFT JOIN public.poll AS poll_row ON poll_row.id = source.unit_id
LEFT JOIN public.book AS book_row ON book_row.id = source.unit_id
LEFT JOIN public.catalog_unit_content_license AS catalog_license_row ON catalog_license_row.unit_id = source.unit_id
LEFT JOIN public.media AS media_row ON media_row.id = source.unit_id
LEFT JOIN public.software AS software_row ON software_row.id = source.unit_id
LEFT JOIN public.unit_structure AS structure_row ON structure_row.id = source.unit_id
LEFT JOIN public.unit_variant AS variant_row ON variant_row.variant_unit_id = source.unit_id
LEFT JOIN public.unit_follow_stat AS follow_stat ON follow_stat.unit_id = source.unit_id
LEFT JOIN LATERAL (
	SELECT CASE
		WHEN unit_row.kind IN ('book', 'software', 'media', 'zone') THEN 'units'
		WHEN unit_row.kind = 'profile' THEN 'users'
		WHEN unit_row.kind = 'entity' THEN 'entity'
		WHEN unit_row.kind = 'tag' THEN 'tags'
		WHEN unit_row.kind = 'structure' THEN 'tag-structures'
		WHEN unit_row.kind = 'post' AND post_row.kind = 'review' THEN 'reviews'
		WHEN unit_row.kind = 'post' THEN 'posts'
		WHEN unit_row.kind = 'realm' THEN 'realms'
		WHEN unit_row.kind = 'collection' THEN 'collections'
		WHEN unit_row.kind = 'poll' THEN 'polls'
	END AS value
) AS category ON true
LEFT JOIN LATERAL (
	SELECT
		EXISTS (
			SELECT 1
			FROM public.unit_structure_vote_stat AS definition_stat
			WHERE definition_stat.structure_id = source.unit_id
				AND definition_stat.score > 0
		)
		AND NOT EXISTS (
			SELECT 1
			FROM public.unit_structure_member AS member
			JOIN public.unit AS member_unit ON member_unit.id = member.member_unit_id
			WHERE member.structure_id = source.unit_id
				AND (
					member_unit.kind <> 'tag'
					OR member_unit.status <> 'published'
					OR member_unit.visibility <> 'public'
					OR member_unit.moderation_status <> 'approved'
					OR member_unit.deleted_at IS NOT NULL
				)
		) AS indexable,
		(
			SELECT jsonb_build_array(string_agg(
				coalesce(primary_localization.title, member.member_unit_id::text),
				' › ' ORDER BY member.ordinal
			))
			FROM public.unit_structure_member AS member
			LEFT JOIN LATERAL (
				SELECT title
				FROM public.unit_localization
				WHERE unit_id = member.member_unit_id
				ORDER BY position, language
				LIMIT 1
			) AS primary_localization ON true
			WHERE member.structure_id = source.unit_id
		) AS primary_titles,
		(
			SELECT jsonb_agg(localization.title ORDER BY member.ordinal,
				localization.position, localization.language)
				FILTER (WHERE localization.title IS NOT NULL)
			FROM public.unit_structure_member AS member
			JOIN public.unit_localization AS localization
				ON localization.unit_id = member.member_unit_id
			WHERE member.structure_id = source.unit_id
		) AS titles,
		(
			SELECT jsonb_agg(DISTINCT localization.language ORDER BY localization.language)
			FROM public.unit_structure_member AS member
			JOIN public.unit_localization AS localization
				ON localization.unit_id = member.member_unit_id
			WHERE member.structure_id = source.unit_id
		) AS languages,
		(
			SELECT jsonb_agg(localization.summary ORDER BY member.ordinal,
				localization.position, localization.language)
				FILTER (WHERE localization.summary IS NOT NULL)
			FROM public.unit_structure_member AS member
			JOIN public.unit_localization AS localization
				ON localization.unit_id = member.member_unit_id
			WHERE member.structure_id = source.unit_id
		) AS summaries,
		(
			SELECT jsonb_agg(DISTINCT alias_row.term ORDER BY alias_row.term)
			FROM public.unit_structure_member AS member
			JOIN public.unit_alias AS alias_row
				ON alias_row.unit_id = member.member_unit_id
			LEFT JOIN public.unit_alias_vote_stat AS alias_stat
				ON alias_stat.alias_id = alias_row.id
			WHERE member.structure_id = source.unit_id
				AND alias_row.deleted_at IS NULL
				AND coalesce(alias_stat.score, 0) >= 3
		) AS aliases
) AS structure_path ON true
LEFT JOIN LATERAL (
	SELECT
		jsonb_agg(language ORDER BY position, language) AS languages,
		jsonb_agg(title ORDER BY position, language) FILTER (WHERE title IS NOT NULL) AS titles,
		jsonb_agg(title ORDER BY position, language) FILTER (WHERE title IS NOT NULL AND ordinal = 1) AS primary_titles,
		jsonb_agg(summary ORDER BY position, language) FILTER (WHERE summary IS NOT NULL) AS summaries,
		jsonb_agg(search_document_text_v1(description) ORDER BY position, language) FILTER (WHERE search_document_text_v1(description) <> '') AS descriptions,
		jsonb_agg(search_document_text_v1(content) ORDER BY position, language) FILTER (WHERE content_status = 'published' AND search_document_text_v1(content) <> '') AS published_content
	FROM (
		SELECT localization.*, row_number() OVER (ORDER BY position, language) AS ordinal
		FROM public.unit_localization AS localization
		WHERE localization.unit_id = source.unit_id
	) AS ordered_localization
) AS localization ON true
LEFT JOIN LATERAL (
	SELECT jsonb_agg(alias_row.term ORDER BY alias_row.term) AS aliases
	FROM public.unit_alias AS alias_row
	LEFT JOIN public.unit_alias_vote_stat AS alias_stat ON alias_stat.alias_id = alias_row.id
	WHERE alias_row.unit_id = source.unit_id AND alias_row.deleted_at IS NULL AND coalesce(alias_stat.score, 0) >= 3
) AS alias_data ON true
LEFT JOIN LATERAL (SELECT jsonb_agg(tag_id ORDER BY tag_id) AS tag_ids FROM public.unit_effective_tag WHERE unit_id = source.unit_id) AS tag_data ON true
LEFT JOIN LATERAL (SELECT jsonb_agg(realm_id ORDER BY realm_id) AS realm_ids FROM public.realm_unit WHERE unit_id = source.unit_id AND status = 'visible') AS realm_data ON true
LEFT JOIN LATERAL (
	SELECT jsonb_agg(
		(realm_id::text || ':' || tag_id::text)
		ORDER BY realm_id, tag_id
	) AS keys
	FROM public.realm_tag_context
	WHERE unit_id = source.unit_id
) AS realm_tag_vote_data ON true
LEFT JOIN LATERAL (
	SELECT jsonb_agg(DISTINCT credited_unit_id ORDER BY credited_unit_id) AS credited_unit_ids
	FROM public.credit_attribution
	WHERE source_unit_id = source.unit_id
) AS attribution_data ON true
LEFT JOIN LATERAL (
	SELECT jsonb_agg(DISTINCT node.owner_unit_id ORDER BY node.owner_unit_id) AS owner_ids
	FROM public.content_structure_node AS node
	JOIN public.content_structure AS structure ON structure.id = node.structure_id
	WHERE node.content_unit_id = source.unit_id
		AND node.deleted_at IS NULL
		AND structure.deleted_at IS NULL
		AND structure.kind IN ('book.contents', 'post.contents')
) AS scope_data ON true
LEFT JOIN LATERAL (
	SELECT
		bool_or(subject_kind = 'authenticated') FILTER (WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS authenticated,
		jsonb_agg(DISTINCT profile_id ORDER BY profile_id) FILTER (WHERE profile_id IS NOT NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS profile_ids,
		jsonb_agg(DISTINCT realm_id ORDER BY realm_id) FILTER (WHERE realm_id IS NOT NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS realm_ids
	FROM public.unit_access_grant
	WHERE unit_id = source.unit_id
		AND permission = 'unit.read'
		AND scope = array[]::text[]
) AS access_data ON true
LEFT JOIN LATERAL (
	SELECT jsonb_agg(DISTINCT profile_id ORDER BY profile_id) AS profile_ids
	FROM public.unit_ownership
	WHERE unit_id = source.unit_id
		AND revoked_at IS NULL
) AS owner_data ON true
LEFT JOIN LATERAL (
	SELECT jsonb_agg(DISTINCT platform_entity_id ORDER BY platform_entity_id) FILTER (WHERE platform_entity_id IS NOT NULL) AS platform_ids,
		jsonb_agg(DISTINCT tier ORDER BY tier) AS tiers
	FROM public.software_requirement WHERE software_id = source.unit_id
) AS requirement_data ON true
LEFT JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM public.unit_variant WHERE main_unit_id = source.unit_id) AS has_variants) AS variant_children ON true
LEFT JOIN LATERAL (
	SELECT stat.snapshot_id, max(stat.engagement_24h) AS engagement_24h
	FROM public.recommendation_unit_stat AS stat
	JOIN public.recommendation_snapshot AS snapshot ON snapshot.id = stat.snapshot_id AND snapshot.active AND snapshot.state = 'ready'
	WHERE stat.unit_id = source.unit_id AND stat.context_realm_id IS NULL
	GROUP BY stat.snapshot_id
) AS recommendation_data ON true
WHERE source.unit_id = ANY($1);
