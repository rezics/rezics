-- Create "shared_search_query" table
CREATE TABLE "shared_search_query" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "document" jsonb NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "shared_search_query_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "shared_search_query_document_check" CHECK (jsonb_typeof(document) = 'object'::text)
);
