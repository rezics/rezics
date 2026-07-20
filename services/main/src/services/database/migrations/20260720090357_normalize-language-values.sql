-- Normalize legacy language tags before the closed content-language constraints are installed.
WITH classified AS (
    SELECT
        ctid,
        unit_id,
        language,
        position,
        updated_at,
        CASE
            WHEN lower(replace(language, '_', '-')) = 'zh' OR lower(replace(language, '_', '-')) LIKE 'zh-%' THEN 'zh'
            WHEN lower(replace(language, '_', '-')) = 'en' OR lower(replace(language, '_', '-')) LIKE 'en-%' THEN 'en'
            ELSE NULL
        END AS target_language
    FROM unit_localization
), ranked AS (
    SELECT
        ctid,
        target_language,
        row_number() OVER (
            PARTITION BY unit_id, target_language
            ORDER BY (language = target_language) DESC, position, updated_at DESC
        ) AS preference_rank
    FROM classified
)
DELETE FROM unit_localization AS localization
USING ranked
WHERE localization.ctid = ranked.ctid
  AND (ranked.target_language IS NULL OR ranked.preference_rank > 1);

UPDATE unit_localization
SET language = CASE
    WHEN lower(replace(language, '_', '-')) = 'zh' OR lower(replace(language, '_', '-')) LIKE 'zh-%' THEN 'zh'
    ELSE 'en'
END
WHERE language NOT IN ('zh', 'en');

WITH classified AS (
    SELECT
        ctid,
        unit_id,
        normalized_term,
        language,
        CASE
            WHEN language IS NULL THEN NULL
            WHEN lower(replace(language, '_', '-')) = 'zh' OR lower(replace(language, '_', '-')) LIKE 'zh-%' THEN 'zh'
            WHEN lower(replace(language, '_', '-')) = 'en' OR lower(replace(language, '_', '-')) LIKE 'en-%' THEN 'en'
            ELSE NULL
        END AS target_language
    FROM unit_alias
    WHERE deleted_at IS NULL
), ranked AS (
    SELECT
        ctid,
        row_number() OVER (
            PARTITION BY unit_id, target_language, normalized_term
            ORDER BY (language IS NOT DISTINCT FROM target_language) DESC, ctid
        ) AS preference_rank
    FROM classified
)
UPDATE unit_alias AS alias
SET deleted_at = now(), updated_at = now()
FROM ranked
WHERE alias.ctid = ranked.ctid
  AND ranked.preference_rank > 1;

UPDATE unit_alias
SET language = CASE
    WHEN language IS NULL THEN NULL
    WHEN lower(replace(language, '_', '-')) = 'zh' OR lower(replace(language, '_', '-')) LIKE 'zh-%' THEN 'zh'
    WHEN lower(replace(language, '_', '-')) = 'en' OR lower(replace(language, '_', '-')) LIKE 'en-%' THEN 'en'
    ELSE NULL
END
WHERE language IS NOT NULL
  AND language NOT IN ('zh', 'en');

UPDATE realm_rule_acceptance
SET language = CASE
    WHEN language IS NULL THEN NULL
    WHEN lower(replace(language, '_', '-')) = 'zh' OR lower(replace(language, '_', '-')) LIKE 'zh-%' THEN 'zh'
    WHEN lower(replace(language, '_', '-')) = 'en' OR lower(replace(language, '_', '-')) LIKE 'en-%' THEN 'en'
    ELSE NULL
END
WHERE language IS NOT NULL
  AND language NOT IN ('zh', 'en');

WITH normalized AS (
    SELECT
        preference.profile_id,
        CASE
            WHEN lower(replace(value.language, '_', '-')) = 'zh' OR lower(replace(value.language, '_', '-')) LIKE 'zh-%' THEN 'zh'
            WHEN lower(replace(value.language, '_', '-')) = 'en' OR lower(replace(value.language, '_', '-')) LIKE 'en-%' THEN 'en'
            ELSE NULL
        END AS language,
        value.ordinality
    FROM profile_preference AS preference
    CROSS JOIN LATERAL unnest(preference.preferred_languages) WITH ORDINALITY AS value(language, ordinality)
), first_occurrence AS (
    SELECT profile_id, language, min(ordinality) AS first_ordinality
    FROM normalized
    WHERE language IS NOT NULL
    GROUP BY profile_id, language
), aggregated AS (
    SELECT profile_id, array_agg(language ORDER BY first_ordinality)::text[] AS preferred_languages
    FROM first_occurrence
    GROUP BY profile_id
)
UPDATE profile_preference AS preference
SET preferred_languages = coalesce(aggregated.preferred_languages, ARRAY['zh']::text[])
FROM (SELECT profile_id FROM profile_preference) AS profiles
LEFT JOIN aggregated USING (profile_id)
WHERE preference.profile_id = profiles.profile_id;
