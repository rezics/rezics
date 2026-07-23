SELECT
	source.revision_id,
	source.revision,
	(revision_row.id IS NOT NULL AND NOT revision_row.suppressed) AS indexable,
	CASE WHEN revision_row.id IS NULL OR revision_row.suppressed THEN NULL ELSE jsonb_build_object(
		'id', source.revision_id,
		'projectionVersion', 1,
		'revision', source.revision,
		'unitId', revision_row.unit_id,
		'parentRevisionId', revision_row.parent_revision_id,
		'unitType', coalesce(main_content.payload ->> 'kind', unit_row.kind),
		'search', jsonb_build_object(
			'historicalTitles', CASE WHEN revision_row.content_hidden THEN '[]'::jsonb ELSE coalesce(snapshot_text.titles, '[]'::jsonb) END,
			'editSummary', CASE WHEN revision_row.summary_hidden THEN '' ELSE coalesce(revision_row.edit_summary, '') END,
			'publicContent', CASE WHEN revision_row.content_hidden THEN '[]'::jsonb ELSE coalesce(snapshot_text.content, '[]'::jsonb) END
		),
		'filters', jsonb_build_object(
			'actorProfileId', CASE WHEN revision_row.actor_hidden THEN NULL ELSE revision_row.actor_profile_id END,
			'minor', revision_row.minor,
			'tags', coalesce(tag_data.tags, '[]'::jsonb),
			'createdAt', extract(epoch FROM revision_row.created_at)::bigint
		),
		'visibility', jsonb_build_object(
			'contentVisible', NOT revision_row.content_hidden,
			'summaryVisible', NOT revision_row.summary_hidden,
			'actorVisible', NOT revision_row.actor_hidden
		)
	) END AS document
FROM public.search_revision_projection_source AS source
LEFT JOIN public.unit_revision AS revision_row ON revision_row.id = source.revision_id
LEFT JOIN public.unit AS unit_row ON unit_row.id = revision_row.unit_id
LEFT JOIN public.unit_revision_slot AS main_slot ON main_slot.revision_id = source.revision_id AND main_slot.role = 'main'
LEFT JOIN public.revision_content AS main_content ON main_content.id = main_slot.content_id
LEFT JOIN LATERAL (
	SELECT
		jsonb_agg(localization ->> 'title' ORDER BY localization ->> 'position', localization ->> 'language') FILTER (WHERE jsonb_typeof(localization -> 'title') = 'string') AS titles,
		jsonb_agg(text_value ORDER BY ordinal) FILTER (WHERE text_value <> '') AS content
	FROM (
		SELECT
			localization_content.payload -> 'localization' AS localization,
			row_number() OVER (
				ORDER BY
					localization_content.payload -> 'localization' ->> 'position',
					localization_slot.slot_key
			) AS ordinal
		FROM public.unit_revision_slot AS localization_slot
		JOIN public.revision_content AS localization_content
			ON localization_content.id = localization_slot.content_id
		WHERE localization_slot.revision_id = source.revision_id
			AND localization_slot.role = 'localization'
	) AS item
	CROSS JOIN LATERAL (VALUES (concat_ws(' ', search_document_text_v1(localization -> 'description'), search_document_text_v1(localization -> 'content')))) AS extracted(text_value)
) AS snapshot_text ON true
LEFT JOIN LATERAL (
	SELECT jsonb_agg(tag ORDER BY tag) AS tags FROM public.unit_revision_tag WHERE revision_id = source.revision_id
) AS tag_data ON true
WHERE source.revision_id = ANY($1);
