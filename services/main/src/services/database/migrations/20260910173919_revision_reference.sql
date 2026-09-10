SET search_path TO public;

-- Create "revision_reference" table
CREATE TABLE "revision_reference" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "publishing_named_form_owner_id" uuid NULL,
  "publishing_named_form_item_id" uuid NULL,
  "publishing_named_form_revision" bigint NULL,
  "publishing_identifier_claim_owner_id" uuid NULL,
  "publishing_identifier_claim_item_id" uuid NULL,
  "publishing_identifier_claim_revision" bigint NULL,
  "music_named_form_owner_id" uuid NULL,
  "music_named_form_item_id" uuid NULL,
  "music_named_form_revision" bigint NULL,
  "music_identifier_claim_owner_id" uuid NULL,
  "music_identifier_claim_item_id" uuid NULL,
  "music_identifier_claim_revision" bigint NULL,
  "program_named_form_owner_id" uuid NULL,
  "program_named_form_item_id" uuid NULL,
  "program_named_form_revision" bigint NULL,
  "program_identifier_claim_owner_id" uuid NULL,
  "program_identifier_claim_item_id" uuid NULL,
  "program_identifier_claim_revision" bigint NULL,
  "software_named_form_owner_id" uuid NULL,
  "software_named_form_item_id" uuid NULL,
  "software_named_form_revision" bigint NULL,
  "software_identifier_claim_owner_id" uuid NULL,
  "software_identifier_claim_item_id" uuid NULL,
  "software_identifier_claim_revision" bigint NULL,
  "entity_named_form_owner_id" uuid NULL,
  "entity_named_form_item_id" uuid NULL,
  "entity_named_form_revision" bigint NULL,
  "entity_identifier_claim_owner_id" uuid NULL,
  "entity_identifier_claim_item_id" uuid NULL,
  "entity_identifier_claim_revision" bigint NULL,
  "grouping_named_form_owner_id" uuid NULL,
  "grouping_named_form_item_id" uuid NULL,
  "grouping_named_form_revision" bigint NULL,
  "grouping_identifier_claim_owner_id" uuid NULL,
  "grouping_identifier_claim_item_id" uuid NULL,
  "grouping_identifier_claim_revision" bigint NULL,
  "reference_named_form_owner_id" uuid NULL,
  "reference_named_form_item_id" uuid NULL,
  "reference_named_form_revision" bigint NULL,
  "reference_identifier_claim_owner_id" uuid NULL,
  "reference_identifier_claim_item_id" uuid NULL,
  "reference_identifier_claim_revision" bigint NULL,
  "distribution_named_form_owner_id" uuid NULL,
  "distribution_named_form_item_id" uuid NULL,
  "distribution_named_form_revision" bigint NULL,
  "distribution_identifier_claim_owner_id" uuid NULL,
  "distribution_identifier_claim_item_id" uuid NULL,
  "distribution_identifier_claim_revision" bigint NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "revision_reference_distribution_identifier_claim_fk" FOREIGN KEY ("distribution_identifier_claim_owner_id", "distribution_identifier_claim_item_id", "distribution_identifier_claim_revision") REFERENCES "distribution_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_distribution_named_form_fk" FOREIGN KEY ("distribution_named_form_owner_id", "distribution_named_form_item_id", "distribution_named_form_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_entity_identifier_claim_fk" FOREIGN KEY ("entity_identifier_claim_owner_id", "entity_identifier_claim_item_id", "entity_identifier_claim_revision") REFERENCES "entity_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_entity_named_form_fk" FOREIGN KEY ("entity_named_form_owner_id", "entity_named_form_item_id", "entity_named_form_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_grouping_identifier_claim_fk" FOREIGN KEY ("grouping_identifier_claim_owner_id", "grouping_identifier_claim_item_id", "grouping_identifier_claim_revision") REFERENCES "grouping_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_grouping_named_form_fk" FOREIGN KEY ("grouping_named_form_owner_id", "grouping_named_form_item_id", "grouping_named_form_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_music_identifier_claim_fk" FOREIGN KEY ("music_identifier_claim_owner_id", "music_identifier_claim_item_id", "music_identifier_claim_revision") REFERENCES "music_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_music_named_form_fk" FOREIGN KEY ("music_named_form_owner_id", "music_named_form_item_id", "music_named_form_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_program_identifier_claim_fk" FOREIGN KEY ("program_identifier_claim_owner_id", "program_identifier_claim_item_id", "program_identifier_claim_revision") REFERENCES "program_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_program_named_form_fk" FOREIGN KEY ("program_named_form_owner_id", "program_named_form_item_id", "program_named_form_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_publishing_identifier_claim_fk" FOREIGN KEY ("publishing_identifier_claim_owner_id", "publishing_identifier_claim_item_id", "publishing_identifier_claim_revision") REFERENCES "publishing_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_publishing_named_form_fk" FOREIGN KEY ("publishing_named_form_owner_id", "publishing_named_form_item_id", "publishing_named_form_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_reference_identifier_claim_fk" FOREIGN KEY ("reference_identifier_claim_owner_id", "reference_identifier_claim_item_id", "reference_identifier_claim_revision") REFERENCES "reference_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_reference_named_form_fk" FOREIGN KEY ("reference_named_form_owner_id", "reference_named_form_item_id", "reference_named_form_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_software_identifier_claim_fk" FOREIGN KEY ("software_identifier_claim_owner_id", "software_identifier_claim_item_id", "software_identifier_claim_revision") REFERENCES "software_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_software_named_form_fk" FOREIGN KEY ("software_named_form_owner_id", "software_named_form_item_id", "software_named_form_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "revision_reference_distribution_identifier_claim_complete_check" CHECK ((num_nonnulls(distribution_identifier_claim_owner_id, distribution_identifier_claim_item_id, distribution_identifier_claim_revision) = 0) OR ((num_nonnulls(distribution_identifier_claim_owner_id, distribution_identifier_claim_item_id, distribution_identifier_claim_revision) = 3) AND ((distribution_identifier_claim_revision >= 1) AND (distribution_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_distribution_named_form_complete_check" CHECK ((num_nonnulls(distribution_named_form_owner_id, distribution_named_form_item_id, distribution_named_form_revision) = 0) OR ((num_nonnulls(distribution_named_form_owner_id, distribution_named_form_item_id, distribution_named_form_revision) = 3) AND ((distribution_named_form_revision >= 1) AND (distribution_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_entity_identifier_claim_complete_check" CHECK ((num_nonnulls(entity_identifier_claim_owner_id, entity_identifier_claim_item_id, entity_identifier_claim_revision) = 0) OR ((num_nonnulls(entity_identifier_claim_owner_id, entity_identifier_claim_item_id, entity_identifier_claim_revision) = 3) AND ((entity_identifier_claim_revision >= 1) AND (entity_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_entity_named_form_complete_check" CHECK ((num_nonnulls(entity_named_form_owner_id, entity_named_form_item_id, entity_named_form_revision) = 0) OR ((num_nonnulls(entity_named_form_owner_id, entity_named_form_item_id, entity_named_form_revision) = 3) AND ((entity_named_form_revision >= 1) AND (entity_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_grouping_identifier_claim_complete_check" CHECK ((num_nonnulls(grouping_identifier_claim_owner_id, grouping_identifier_claim_item_id, grouping_identifier_claim_revision) = 0) OR ((num_nonnulls(grouping_identifier_claim_owner_id, grouping_identifier_claim_item_id, grouping_identifier_claim_revision) = 3) AND ((grouping_identifier_claim_revision >= 1) AND (grouping_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_grouping_named_form_complete_check" CHECK ((num_nonnulls(grouping_named_form_owner_id, grouping_named_form_item_id, grouping_named_form_revision) = 0) OR ((num_nonnulls(grouping_named_form_owner_id, grouping_named_form_item_id, grouping_named_form_revision) = 3) AND ((grouping_named_form_revision >= 1) AND (grouping_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_music_identifier_claim_complete_check" CHECK ((num_nonnulls(music_identifier_claim_owner_id, music_identifier_claim_item_id, music_identifier_claim_revision) = 0) OR ((num_nonnulls(music_identifier_claim_owner_id, music_identifier_claim_item_id, music_identifier_claim_revision) = 3) AND ((music_identifier_claim_revision >= 1) AND (music_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_music_named_form_complete_check" CHECK ((num_nonnulls(music_named_form_owner_id, music_named_form_item_id, music_named_form_revision) = 0) OR ((num_nonnulls(music_named_form_owner_id, music_named_form_item_id, music_named_form_revision) = 3) AND ((music_named_form_revision >= 1) AND (music_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_program_identifier_claim_complete_check" CHECK ((num_nonnulls(program_identifier_claim_owner_id, program_identifier_claim_item_id, program_identifier_claim_revision) = 0) OR ((num_nonnulls(program_identifier_claim_owner_id, program_identifier_claim_item_id, program_identifier_claim_revision) = 3) AND ((program_identifier_claim_revision >= 1) AND (program_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_program_named_form_complete_check" CHECK ((num_nonnulls(program_named_form_owner_id, program_named_form_item_id, program_named_form_revision) = 0) OR ((num_nonnulls(program_named_form_owner_id, program_named_form_item_id, program_named_form_revision) = 3) AND ((program_named_form_revision >= 1) AND (program_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_publishing_identifier_claim_complete_check" CHECK ((num_nonnulls(publishing_identifier_claim_owner_id, publishing_identifier_claim_item_id, publishing_identifier_claim_revision) = 0) OR ((num_nonnulls(publishing_identifier_claim_owner_id, publishing_identifier_claim_item_id, publishing_identifier_claim_revision) = 3) AND ((publishing_identifier_claim_revision >= 1) AND (publishing_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_publishing_named_form_complete_check" CHECK ((num_nonnulls(publishing_named_form_owner_id, publishing_named_form_item_id, publishing_named_form_revision) = 0) OR ((num_nonnulls(publishing_named_form_owner_id, publishing_named_form_item_id, publishing_named_form_revision) = 3) AND ((publishing_named_form_revision >= 1) AND (publishing_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_reference_identifier_claim_complete_check" CHECK ((num_nonnulls(reference_identifier_claim_owner_id, reference_identifier_claim_item_id, reference_identifier_claim_revision) = 0) OR ((num_nonnulls(reference_identifier_claim_owner_id, reference_identifier_claim_item_id, reference_identifier_claim_revision) = 3) AND ((reference_identifier_claim_revision >= 1) AND (reference_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_reference_named_form_complete_check" CHECK ((num_nonnulls(reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision) = 0) OR ((num_nonnulls(reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision) = 3) AND ((reference_named_form_revision >= 1) AND (reference_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_software_identifier_claim_complete_check" CHECK ((num_nonnulls(software_identifier_claim_owner_id, software_identifier_claim_item_id, software_identifier_claim_revision) = 0) OR ((num_nonnulls(software_identifier_claim_owner_id, software_identifier_claim_item_id, software_identifier_claim_revision) = 3) AND ((software_identifier_claim_revision >= 1) AND (software_identifier_claim_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_software_named_form_complete_check" CHECK ((num_nonnulls(software_named_form_owner_id, software_named_form_item_id, software_named_form_revision) = 0) OR ((num_nonnulls(software_named_form_owner_id, software_named_form_item_id, software_named_form_revision) = 3) AND ((software_named_form_revision >= 1) AND (software_named_form_revision <= '9007199254740991'::bigint)))),
  CONSTRAINT "revision_reference_target_check" CHECK (num_nonnulls(publishing_named_form_owner_id, publishing_identifier_claim_owner_id, music_named_form_owner_id, music_identifier_claim_owner_id, program_named_form_owner_id, program_identifier_claim_owner_id, software_named_form_owner_id, software_identifier_claim_owner_id, entity_named_form_owner_id, entity_identifier_claim_owner_id, grouping_named_form_owner_id, grouping_identifier_claim_owner_id, reference_named_form_owner_id, reference_identifier_claim_owner_id, distribution_named_form_owner_id, distribution_identifier_claim_owner_id) = 1)
);
-- Create index "revision_reference_distribution_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_distribution_identifier_claim_key" ON "revision_reference" ("distribution_identifier_claim_owner_id", "distribution_identifier_claim_item_id", "distribution_identifier_claim_revision") WHERE (distribution_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_distribution_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_distribution_named_form_key" ON "revision_reference" ("distribution_named_form_owner_id", "distribution_named_form_item_id", "distribution_named_form_revision") WHERE (distribution_named_form_owner_id IS NOT NULL);
-- Create index "revision_reference_entity_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_entity_identifier_claim_key" ON "revision_reference" ("entity_identifier_claim_owner_id", "entity_identifier_claim_item_id", "entity_identifier_claim_revision") WHERE (entity_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_entity_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_entity_named_form_key" ON "revision_reference" ("entity_named_form_owner_id", "entity_named_form_item_id", "entity_named_form_revision") WHERE (entity_named_form_owner_id IS NOT NULL);
-- Create index "revision_reference_grouping_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_grouping_identifier_claim_key" ON "revision_reference" ("grouping_identifier_claim_owner_id", "grouping_identifier_claim_item_id", "grouping_identifier_claim_revision") WHERE (grouping_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_grouping_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_grouping_named_form_key" ON "revision_reference" ("grouping_named_form_owner_id", "grouping_named_form_item_id", "grouping_named_form_revision") WHERE (grouping_named_form_owner_id IS NOT NULL);
-- Create index "revision_reference_music_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_music_identifier_claim_key" ON "revision_reference" ("music_identifier_claim_owner_id", "music_identifier_claim_item_id", "music_identifier_claim_revision") WHERE (music_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_music_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_music_named_form_key" ON "revision_reference" ("music_named_form_owner_id", "music_named_form_item_id", "music_named_form_revision") WHERE (music_named_form_owner_id IS NOT NULL);
-- Create index "revision_reference_program_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_program_identifier_claim_key" ON "revision_reference" ("program_identifier_claim_owner_id", "program_identifier_claim_item_id", "program_identifier_claim_revision") WHERE (program_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_program_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_program_named_form_key" ON "revision_reference" ("program_named_form_owner_id", "program_named_form_item_id", "program_named_form_revision") WHERE (program_named_form_owner_id IS NOT NULL);
-- Create index "revision_reference_publishing_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_publishing_identifier_claim_key" ON "revision_reference" ("publishing_identifier_claim_owner_id", "publishing_identifier_claim_item_id", "publishing_identifier_claim_revision") WHERE (publishing_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_publishing_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_publishing_named_form_key" ON "revision_reference" ("publishing_named_form_owner_id", "publishing_named_form_item_id", "publishing_named_form_revision") WHERE (publishing_named_form_owner_id IS NOT NULL);
-- Create index "revision_reference_reference_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_reference_identifier_claim_key" ON "revision_reference" ("reference_identifier_claim_owner_id", "reference_identifier_claim_item_id", "reference_identifier_claim_revision") WHERE (reference_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_reference_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_reference_named_form_key" ON "revision_reference" ("reference_named_form_owner_id", "reference_named_form_item_id", "reference_named_form_revision") WHERE (reference_named_form_owner_id IS NOT NULL);
-- Create index "revision_reference_software_identifier_claim_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_software_identifier_claim_key" ON "revision_reference" ("software_identifier_claim_owner_id", "software_identifier_claim_item_id", "software_identifier_claim_revision") WHERE (software_identifier_claim_owner_id IS NOT NULL);
-- Create index "revision_reference_software_named_form_key" to table: "revision_reference"
CREATE UNIQUE INDEX "revision_reference_software_named_form_key" ON "revision_reference" ("software_named_form_owner_id", "software_named_form_item_id", "software_named_form_revision") WHERE (software_named_form_owner_id IS NOT NULL);

DROP TRIGGER IF EXISTS revision_reference_immutable ON public.revision_reference;
CREATE TRIGGER revision_reference_immutable
BEFORE UPDATE OR DELETE ON public.revision_reference
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
