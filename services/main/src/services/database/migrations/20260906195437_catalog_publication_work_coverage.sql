SET search_path TO public;

-- Create "publishing_publication_work" table
CREATE TABLE "publishing_publication_work" (
  "publication_id" uuid NOT NULL,
  "work_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "coverage_text" text NULL,
  PRIMARY KEY ("publication_id", "work_id"),
  CONSTRAINT "publishing_publication_work_eXnE7Xy7eB7m_fkey" FOREIGN KEY ("publication_id") REFERENCES "publishing_publication" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_publication_work_work_id_publishing_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "publishing_work" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_publication_work_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint))
);
-- Create index "publishing_publication_work_order_idx" to table: "publishing_publication_work"
CREATE INDEX "publishing_publication_work_order_idx" ON "publishing_publication_work" ("publication_id", "position", "work_id");
-- Create index "publishing_publication_work_reverse_idx" to table: "publishing_publication_work"
CREATE INDEX "publishing_publication_work_reverse_idx" ON "publishing_publication_work" ("work_id", "publication_id");
