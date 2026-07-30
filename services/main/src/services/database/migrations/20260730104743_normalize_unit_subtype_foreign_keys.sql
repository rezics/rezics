-- Modify "audio" table
ALTER TABLE "audio" DROP CONSTRAINT "audio_unit_kind_check", DROP COLUMN "unit_kind", ADD CONSTRAINT "audio_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "tag" table
ALTER TABLE "tag" DROP CONSTRAINT "tag_unit_kind_check", DROP COLUMN "unit_kind", ADD CONSTRAINT "tag_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "unit_structure" table
ALTER TABLE "unit_structure" DROP CONSTRAINT "unit_structure_unit_kind_check", DROP COLUMN "unit_kind", ADD CONSTRAINT "unit_structure_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Keep the database-maintained member projection aligned with its normalized table shape.
CREATE OR REPLACE FUNCTION project_unit_structure_definition() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM unit_structure_edge
    WHERE structure_id = NEW.id;
    DELETE FROM unit_structure_member
    WHERE structure_id = NEW.id;
  END IF;

  INSERT INTO unit_structure_member (
    structure_id,
    ordinal,
    member_unit_id
  )
  SELECT NEW.id, member.ordinality - 1, member.id
  FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality);

  INSERT INTO unit_structure_edge (
    structure_id,
    ordinal,
    parent_unit_id,
    child_unit_id
  )
  SELECT NEW.id, member.ordinality - 1, member.id, NEW.member_unit_ids[member.ordinality + 1]
  FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality)
  WHERE member.ordinality < cardinality(NEW.member_unit_ids);

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO unit_tag_structure_support (
      unit_id,
      tag_id,
      profile_id,
      structure_id
    )
    SELECT
      application_vote.unit_id,
      member.member_unit_id,
      application_vote.profile_id,
      application_vote.structure_id
    FROM unit_structure_application_vote application_vote
    JOIN unit_structure_member member
      ON member.structure_id = application_vote.structure_id
    WHERE application_vote.structure_id = NEW.id
      AND application_vote.value = 1
    ORDER BY
      application_vote.unit_id,
      member.member_unit_id,
      application_vote.profile_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END
$$;
-- Modify "unit_structure_member" table
ALTER TABLE "unit_structure_member" DROP COLUMN "member_unit_kind", ADD CONSTRAINT "unit_structure_member_member_unit_id_unit_id_fkey" FOREIGN KEY ("member_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "video" table
ALTER TABLE "video" DROP CONSTRAINT "video_unit_kind_check", DROP COLUMN "unit_kind", ADD CONSTRAINT "video_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
