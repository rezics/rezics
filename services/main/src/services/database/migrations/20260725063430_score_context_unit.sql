-- Rename Score context identifiers without discarding existing data.
ALTER TABLE "profile_preference"
  RENAME COLUMN "default_score_realm_id" TO "default_score_context_unit_id";
ALTER TABLE "profile_preference"
  DROP CONSTRAINT "profile_preference_default_score_realm_id_realm_id_fkey",
  ADD CONSTRAINT "profile_preference_default_score_context_unit_id_unit_id_fkey"
    FOREIGN KEY ("default_score_context_unit_id") REFERENCES "unit" ("id")
    ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER INDEX "profile_preference_default_score_realm_idx"
  RENAME TO "profile_preference_default_score_context_unit_idx";

ALTER TABLE "score" RENAME COLUMN "realm_id" TO "context_unit_id";
ALTER TABLE "score"
  RENAME CONSTRAINT "score_profile_unit_realm_key"
  TO "score_profile_unit_context_unit_key";
ALTER TABLE "score"
  DROP CONSTRAINT "score_realm_id_realm_id_fkey",
  ADD CONSTRAINT "score_context_unit_id_unit_id_fkey"
    FOREIGN KEY ("context_unit_id") REFERENCES "unit" ("id")
    ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER INDEX "score_realm_idx" RENAME TO "score_context_unit_idx";
ALTER INDEX "score_unit_realm_value_idx"
  RENAME TO "score_unit_context_unit_value_idx";

ALTER TABLE "score_stat" RENAME COLUMN "realm_id" TO "context_unit_id";
ALTER TABLE "score_stat"
  DROP CONSTRAINT "score_stat_realm_id_realm_id_fkey",
  ADD CONSTRAINT "score_stat_context_unit_id_unit_id_fkey"
    FOREIGN KEY ("context_unit_id") REFERENCES "unit" ("id")
    ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER INDEX "score_stat_realm_idx" RENAME TO "score_stat_context_unit_idx";

CREATE OR REPLACE FUNCTION maintain_score_stat() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  row_data score%ROWTYPE;
  direction bigint;
  signal_kind text;
  unit_weight double precision;
  profile_weight double precision;
  change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data;
    direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit WHERE id = row_data.unit_id)
      AND EXISTS (SELECT 1 FROM unit WHERE id = row_data.context_unit_id) THEN
      IF direction < 0 THEN
        UPDATE score_stat SET
          total_count = total_count + direction,
          total_score = total_score + direction * row_data.value,
          score_1_count = score_1_count + direction * (row_data.value = 1)::int,
          score_2_count = score_2_count + direction * (row_data.value = 2)::int,
          score_3_count = score_3_count + direction * (row_data.value = 3)::int,
          score_4_count = score_4_count + direction * (row_data.value = 4)::int,
          score_5_count = score_5_count + direction * (row_data.value = 5)::int,
          score_6_count = score_6_count + direction * (row_data.value = 6)::int,
          score_7_count = score_7_count + direction * (row_data.value = 7)::int,
          score_8_count = score_8_count + direction * (row_data.value = 8)::int,
          score_9_count = score_9_count + direction * (row_data.value = 9)::int,
          score_10_count = score_10_count + direction * (row_data.value = 10)::int,
          updated_at = now()
        WHERE unit_id = row_data.unit_id
          AND context_unit_id = row_data.context_unit_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing score_stat row for decrement: %, %',
            row_data.unit_id, row_data.context_unit_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO score_stat (
          unit_id, context_unit_id, total_count, total_score,
          score_1_count, score_2_count, score_3_count, score_4_count, score_5_count,
          score_6_count, score_7_count, score_8_count, score_9_count, score_10_count
        ) VALUES (
          row_data.unit_id, row_data.context_unit_id, direction, direction * row_data.value,
          direction * (row_data.value = 1)::int, direction * (row_data.value = 2)::int,
          direction * (row_data.value = 3)::int, direction * (row_data.value = 4)::int,
          direction * (row_data.value = 5)::int, direction * (row_data.value = 6)::int,
          direction * (row_data.value = 7)::int, direction * (row_data.value = 8)::int,
          direction * (row_data.value = 9)::int, direction * (row_data.value = 10)::int
        )
        ON CONFLICT (unit_id, context_unit_id) DO UPDATE SET
          total_count = score_stat.total_count + excluded.total_count,
          total_score = score_stat.total_score + excluded.total_score,
          score_1_count = score_stat.score_1_count + excluded.score_1_count,
          score_2_count = score_stat.score_2_count + excluded.score_2_count,
          score_3_count = score_stat.score_3_count + excluded.score_3_count,
          score_4_count = score_stat.score_4_count + excluded.score_4_count,
          score_5_count = score_stat.score_5_count + excluded.score_5_count,
          score_6_count = score_stat.score_6_count + excluded.score_6_count,
          score_7_count = score_stat.score_7_count + excluded.score_7_count,
          score_8_count = score_stat.score_8_count + excluded.score_8_count,
          score_9_count = score_stat.score_9_count + excluded.score_9_count,
          score_10_count = score_stat.score_10_count + excluded.score_10_count,
          updated_at = now();
      END IF;
      DELETE FROM score_stat
      WHERE unit_id = row_data.unit_id
        AND context_unit_id = row_data.context_unit_id
        AND total_count = 0;
    END IF;

    PERFORM apply_unit_engagement_stat(
      row_data.unit_id, p_high_scores => direction * (row_data.value >= 8)::int
    );
    IF row_data.value >= 8 THEN
      signal_kind := 'score_high'; unit_weight := 5; profile_weight := 5;
    ELSIF row_data.value >= 6 THEN
      signal_kind := 'score_medium'; unit_weight := 3; profile_weight := 3;
    ELSIF row_data.value <= 3 THEN
      signal_kind := 'score_low'; unit_weight := 0; profile_weight := -4;
    ELSE
      signal_kind := NULL; unit_weight := 0; profile_weight := 0;
    END IF;
    IF signal_kind IS NOT NULL THEN
      IF unit_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.updated_at, signal_kind, direction, direction * unit_weight
        );
      END IF;
      PERFORM apply_recommendation_profile_signal(
        row_data.profile_id, row_data.unit_id, row_data.updated_at, signal_kind,
        direction, direction * profile_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
