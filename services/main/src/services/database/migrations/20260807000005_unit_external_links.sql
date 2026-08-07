-- Preserve the existing Unit link graph while aligning its persisted names with
-- the 1.6 API contract. These operations rename existing objects in place;
-- they do not drop tables, columns, votes, or aggregate rows.

ALTER TABLE public.unit_reference_curation_head
    DROP CONSTRAINT unit_reference_curation_head_kind_check;

UPDATE public.unit_reference_curation_head
SET kind = 'external_link'
WHERE kind = 'source_link';

ALTER TABLE public.unit_reference_curation_head
    ADD CONSTRAINT unit_reference_curation_head_kind_check
    CHECK (kind = ANY (ARRAY['alias'::text, 'external_link'::text]));

ALTER FUNCTION public.maintain_unit_source_link_vote_stat()
    RENAME TO maintain_unit_external_link_vote_stat;

ALTER TABLE public.unit_source_link
    RENAME TO unit_external_link;

ALTER TABLE public.unit_source_link_vote
    RENAME TO unit_external_link_vote;

ALTER TABLE public.unit_source_link_vote_stat
    RENAME TO unit_external_link_vote_stat;

ALTER TABLE public.unit_external_link_vote
    RENAME COLUMN link_id TO external_link_id;

ALTER TABLE public.unit_external_link_vote_stat
    RENAME COLUMN link_id TO external_link_id;

ALTER TABLE public.software_requirement
    RENAME COLUMN source_link_id TO source_external_link_id;

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_pkey TO unit_external_link_pkey;

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_unit_source_hash_key
    TO unit_external_link_unit_source_hash_key;

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_hash_check TO unit_external_link_hash_check;

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_pinned_position_check
    TO unit_external_link_pinned_position_check;

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_url_check TO unit_external_link_url_check;

ALTER TABLE public.unit_external_link_vote
    RENAME CONSTRAINT unit_source_link_vote_pkey TO unit_external_link_vote_pkey;

ALTER TABLE public.unit_external_link_vote
    RENAME CONSTRAINT unit_source_link_vote_value_check
    TO unit_external_link_vote_value_check;

ALTER TABLE public.unit_external_link_vote_stat
    RENAME CONSTRAINT unit_source_link_vote_stat_pkey TO unit_external_link_vote_stat_pkey;

ALTER TABLE public.unit_external_link_vote_stat
    RENAME CONSTRAINT unit_source_link_vote_stat_count_check
    TO unit_external_link_vote_stat_count_check;

ALTER TABLE public.unit_external_link_vote_stat
    RENAME CONSTRAINT unit_source_link_vote_stat_score_check
    TO unit_external_link_vote_stat_score_check;

ALTER TABLE public.software_requirement
    RENAME CONSTRAINT software_requirement_source_link_id_unit_source_link_id_fkey
    TO "software_requirement_zBRhf6GeMaXo_fkey";

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_created_by_profile_id_profile_id_fkey
    TO unit_external_link_created_by_profile_id_profile_id_fkey;

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_source_entity_id_entity_id_fkey
    TO unit_external_link_source_entity_id_entity_id_fkey;

ALTER TABLE public.unit_external_link
    RENAME CONSTRAINT unit_source_link_unit_id_unit_id_fkey
    TO unit_external_link_unit_id_unit_id_fkey;

ALTER TABLE public.unit_external_link_vote
    RENAME CONSTRAINT unit_source_link_vote_link_id_unit_source_link_id_fkey
    TO "unit_external_link_vote_uSLV0w3BSokT_fkey";

ALTER TABLE public.unit_external_link_vote
    RENAME CONSTRAINT unit_source_link_vote_profile_id_profile_id_fkey
    TO unit_external_link_vote_profile_id_profile_id_fkey;

ALTER TABLE public.unit_external_link_vote_stat
    RENAME CONSTRAINT unit_source_link_vote_stat_link_id_unit_source_link_id_fkey
    TO "unit_external_link_vote_stat_TeydsZjU8QsG_fkey";

ALTER INDEX public.software_requirement_source_link_idx
    RENAME TO software_requirement_source_external_link_idx;

ALTER INDEX public.unit_source_link_created_by_idx
    RENAME TO unit_external_link_created_by_idx;

ALTER INDEX public.unit_source_link_source_entity_idx
    RENAME TO unit_external_link_source_entity_idx;

ALTER INDEX public.unit_source_link_unit_pinned_position_unique
    RENAME TO unit_external_link_unit_pinned_position_unique;

ALTER INDEX public.unit_source_link_unit_position_idx
    RENAME TO unit_external_link_unit_position_idx;

ALTER INDEX public.unit_source_link_vote_profile_idx
    RENAME TO unit_external_link_vote_profile_idx;

ALTER TRIGGER unit_source_link_vote_stat_maintain
    ON public.unit_external_link_vote
    RENAME TO unit_external_link_vote_stat_maintain;

CREATE OR REPLACE FUNCTION public.maintain_unit_external_link_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data unit_external_link_vote%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit_external_link WHERE id = row_data.external_link_id) THEN
      IF direction < 0 THEN
        UPDATE unit_external_link_vote_stat SET score = score + direction * row_data.value,
          vote_count = vote_count + direction, updated_at = now()
        WHERE external_link_id = row_data.external_link_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_external_link_vote_stat row for decrement: %',
            row_data.external_link_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_external_link_vote_stat (external_link_id, score, vote_count)
        VALUES (row_data.external_link_id, direction * row_data.value, direction)
        ON CONFLICT (external_link_id) DO UPDATE SET
          score = unit_external_link_vote_stat.score + excluded.score,
          vote_count = unit_external_link_vote_stat.vote_count + excluded.vote_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_external_link_vote_stat
      WHERE external_link_id = row_data.external_link_id AND vote_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
