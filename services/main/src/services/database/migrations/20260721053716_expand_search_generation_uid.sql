-- Modify "search_index_generation" table
ALTER TABLE "search_index_generation" DROP CONSTRAINT "search_index_generation_index_uid_check", ADD CONSTRAINT "search_index_generation_index_uid_check" CHECK (index_uid ~ '^rezics_(units|revisions)_v[1-9][0-9]*_[0-9]{8}(_[0-9]{6})?$'::text);
