SET search_path TO public;

ALTER TABLE "schema_contract_field" DROP CONSTRAINT "schema_contract_field_contract_id_schema_contract_id_fkey";
ALTER TABLE "schema_contract_keyword" DROP CONSTRAINT "schema_contract_keyword_VhWqeFhVQ3pz_fkey";
ALTER TABLE "schema_contract_reference" DROP CONSTRAINT "schema_contract_reference_JGdDdyx5AoVE_fkey";
ALTER TABLE "schema_contract_reference" DROP CONSTRAINT "schema_contract_reference_M6B1vWT0VW59_fkey";
ALTER TABLE "schema_profile_revision" DROP CONSTRAINT "schema_profile_revision_profile_id_schema_profile_id_fkey";
ALTER TABLE "schema_profile_rule" DROP CONSTRAINT "schema_profile_rule_52qBaeIzxlEq_fkey";
DROP TABLE "schema_contract";
DROP TABLE "schema_contract_field";
DROP TABLE "schema_contract_keyword";
DROP TABLE "schema_contract_reference";
DROP TABLE "schema_profile";
DROP TABLE "schema_profile_revision";
DROP TABLE "schema_profile_rule";
CREATE TABLE "schema_model_binding" (
	"model_id" uuid,
	"profile_key" text,
	"term_id" uuid,
	"definition_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"role" text,
	CONSTRAINT "schema_model_binding_pkey" PRIMARY KEY("model_id","profile_key","term_id","role"),
	CONSTRAINT "schema_model_binding_role" CHECK ("role" in ('type','property'))
);

CREATE TABLE "schema_model_head" (
	"key" text PRIMARY KEY,
	"model_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	CONSTRAINT "schema_model_head_version" CHECK ("version" between 1 and 9007199254740991)
);

CREATE TABLE "schema_model_profile" (
	"model_id" uuid,
	"key" text,
	"owner" text NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "schema_model_profile_pkey" PRIMARY KEY("model_id","key"),
	CONSTRAINT "schema_model_profile_body" CHECK (jsonb_typeof("body")='object')
);

CREATE TABLE "schema_model_release" (
	"id" uuid PRIMARY KEY,
	"digest" text NOT NULL CONSTRAINT "schema_model_release_digest" UNIQUE,
	"ontology_digest" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_model_release_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$' and "ontology_digest" ~ '^[0-9a-f]{64}$' and jsonb_typeof("body")='object')
);

ALTER TABLE "description_revision" ADD COLUMN "model_id" uuid NOT NULL;
ALTER TABLE "description_revision" ADD COLUMN "profile_key" text NOT NULL;
ALTER TABLE "description_statement" ADD COLUMN "definition_id" uuid NOT NULL;
ALTER TABLE "schema_relation_revision" ADD COLUMN "model_id" uuid;
ALTER TABLE "schema_relation_revision" ADD COLUMN "profile_key" text;
DROP INDEX "schema_revision_target";
CREATE INDEX "schema_revision_target" ON "schema_relation_revision" (("value"->'reference'->>'owner'),("value"->'reference'->>'id'),"predicate_id","id") WHERE "value"->>'kind' = 'reference';
ALTER TABLE "description_revision" ADD CONSTRAINT "description_revision_2_model_fk" FOREIGN KEY ("model_id","profile_key") REFERENCES "schema_model_profile"("model_id","key");
ALTER TABLE "description_statement" ADD CONSTRAINT "description_statement_meaning_fk" FOREIGN KEY ("definition_id","predicate_id") REFERENCES "schema_definition"("id","term_id");
ALTER TABLE "schema_model_binding" ADD CONSTRAINT "schema_model_binding_model_id_schema_model_release_id_fkey" FOREIGN KEY ("model_id") REFERENCES "schema_model_release"("id");
ALTER TABLE "schema_model_binding" ADD CONSTRAINT "schema_model_binding_iBgenpC5CpOx_fkey" FOREIGN KEY ("model_id","profile_key") REFERENCES "schema_model_profile"("model_id","key");
ALTER TABLE "schema_model_binding" ADD CONSTRAINT "schema_model_binding_BygkczmINK4v_fkey" FOREIGN KEY ("definition_id","term_id") REFERENCES "schema_definition"("id","term_id");
ALTER TABLE "schema_model_binding" ADD CONSTRAINT "schema_model_binding_aENFZqCrxTga_fkey" FOREIGN KEY ("release_id","term_id") REFERENCES "schema_release_term"("release_id","term_id");
ALTER TABLE "schema_model_head" ADD CONSTRAINT "schema_model_head_model_id_schema_model_release_id_fkey" FOREIGN KEY ("model_id") REFERENCES "schema_model_release"("id");
ALTER TABLE "schema_model_profile" ADD CONSTRAINT "schema_model_profile_model_id_schema_model_release_id_fkey" FOREIGN KEY ("model_id") REFERENCES "schema_model_release"("id");
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_7e6rEM8MA8L0_fkey" FOREIGN KEY ("model_id","profile_key") REFERENCES "schema_model_profile"("model_id","key");
ALTER TABLE "description_statement" ADD CONSTRAINT "description_statement_order" CHECK ("order_key" is null or "order_key" ~ '^(0|[1-9][0-9]{0,39})$');
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_revision_model_context" CHECK (num_nonnulls("model_id","profile_key") in (0,2));

-- Canonical vocabulary integrity guards. Install through the main schema_complete migration bundle.
CREATE OR REPLACE FUNCTION public.schema_reject_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Schema identities, revisions and decisions are immutable; append a new revision or selection'
    USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_vocabulary
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release_context
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_term
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_term_alias
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_definition
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release_term
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_label
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_release_label
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_change
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_label_selection
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_relation
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_relation_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_relation_selection
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_node
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_statement
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.catalog_definition_binding
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.schema_require_prior_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_exists boolean;
BEGIN
  IF NEW.parent_revision_id IS NOT NULL THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE id = $1 AND relation_id = $2)', TG_TABLE_SCHEMA, TG_TABLE_NAME)
      INTO parent_exists USING NEW.parent_revision_id, NEW.relation_id;
    IF NOT parent_exists THEN
      RAISE EXCEPTION 'A revision parent must already exist for the same relation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER schema_revision_parent BEFORE INSERT ON public.schema_relation_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_require_prior_revision();

CREATE OR REPLACE FUNCTION public.schema_statement_shape_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM schema_node WHERE release_id=NEW.release_id AND id=NEW.subject_id AND kind IN ('iri','blank'))
 OR NOT EXISTS(SELECT 1 FROM schema_node WHERE release_id=NEW.release_id AND id=NEW.graph_id AND kind IN ('iri','blank','default-graph')) THEN
 RAISE EXCEPTION 'Invalid RDF subject or graph node' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_statement_shape_guard BEFORE INSERT ON public.schema_statement FOR EACH ROW EXECUTE FUNCTION public.schema_statement_shape_guard();

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_model_release
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_model_profile
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.schema_model_binding
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.schema_model_profile_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.schema_model_release r, jsonb_array_elements(r.body->'profiles') p
  WHERE r.id=NEW.model_id AND p->>'key'=NEW.key AND p->>'owner'=NEW.owner AND p=NEW.body)
 THEN RAISE EXCEPTION 'Profile differs from its compiled model' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_model_profile_guard BEFORE INSERT ON public.schema_model_profile FOR EACH ROW EXECUTE FUNCTION public.schema_model_profile_guard();

CREATE OR REPLACE FUNCTION public.schema_model_binding_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.schema_model_profile p,jsonb_array_elements(p.body->CASE WHEN NEW.role='type' THEN 'types' ELSE 'properties' END) entry
 WHERE p.model_id=NEW.model_id AND p.key=NEW.profile_key
 AND EXISTS(SELECT 1 FROM public.schema_release_term meaning WHERE meaning.release_id=NEW.release_id AND meaning.term_id=NEW.term_id AND meaning.definition_id=NEW.definition_id)
 AND EXISTS(SELECT 1 FROM public.schema_model_release model,jsonb_array_elements(model.body->'sourceReleases') AS dependency(value) WHERE model.id=NEW.model_id AND (dependency.value->>'id')::uuid=NEW.release_id)
 AND coalesce(entry->>'termId',entry->>'predicateId')=NEW.term_id::text AND entry->>'definitionId'=NEW.definition_id::text AND entry->>'releaseId'=NEW.release_id::text)
 THEN RAISE EXCEPTION 'Binding differs from its compiled profile' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_model_binding_guard BEFORE INSERT ON public.schema_model_binding FOR EACH ROW EXECUTE FUNCTION public.schema_model_binding_guard();

CREATE OR REPLACE FUNCTION public.schema_model_head_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE expected integer; actual integer;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Model selection version is retained' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.key<>OLD.key OR NEW.version<>OLD.version+1)) THEN RAISE EXCEPTION 'Model selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 SELECT jsonb_array_length(body->'profiles') INTO expected FROM public.schema_model_release WHERE id=NEW.model_id;
 SELECT count(*) INTO actual FROM public.schema_model_profile WHERE model_id=NEW.model_id;
 IF expected IS NULL OR expected<>actual THEN RAISE EXCEPTION 'Model profile installation is incomplete' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(jsonb_array_length(body->'types')+jsonb_array_length(body->'properties')),0) INTO expected FROM public.schema_model_profile WHERE model_id=NEW.model_id;
 SELECT count(*) INTO actual FROM public.schema_model_binding WHERE model_id=NEW.model_id;
 IF expected<>actual THEN RAISE EXCEPTION 'Model meaning bindings are incomplete' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.schema_model_release r,jsonb_array_elements(r.body->'sourceReleases') AS dependency(value)
 WHERE r.id=NEW.model_id AND NOT EXISTS(SELECT 1 FROM public.schema_release release WHERE release.id=(dependency.value->>'id')::uuid AND release.digest=dependency.value->>'digest')) THEN RAISE EXCEPTION 'Model source vocabulary is unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_model_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.schema_model_head FOR EACH ROW EXECUTE FUNCTION public.schema_model_head_guard();


-- Domain-local revision authority. No global content/identity insert is required.
CREATE OR REPLACE FUNCTION public.description_revision_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.payload_state='erased' AND (to_jsonb(NEW)-'payload_state')=(to_jsonb(OLD)-'payload_state') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Description revisions only permit payload erasure' USING ERRCODE='23514';
 END IF;
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.description_revision WHERE object_id=NEW.object_id AND id=NEW.parent_id) THEN
  RAISE EXCEPTION 'Description parent must already exist for this object' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER description_revision_guard BEFORE INSERT OR UPDATE ON public.description_revision FOR EACH ROW EXECUTE FUNCTION public.description_revision_guard();

CREATE OR REPLACE FUNCTION public.description_selection_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.description_object WHERE id=NEW.object_id AND state<>'erased' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Description is unavailable' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.description_revision WHERE object_id=NEW.object_id AND id=NEW.revision_id AND payload_state='available' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Description revision is unavailable' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.object_id<>OLD.object_id OR NEW.version<>OLD.version+1)) THEN
  RAISE EXCEPTION 'Description selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER description_selection_guard BEFORE INSERT OR UPDATE ON public.description_selection FOR EACH ROW EXECUTE FUNCTION public.description_selection_guard();
CREATE OR REPLACE TRIGGER description_change_immutable BEFORE UPDATE OR DELETE ON public.description_change FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER description_statement_immutable BEFORE UPDATE ON public.description_statement FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER description_type_immutable BEFORE UPDATE ON public.description_type FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.wiki_revision_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.wiki_revision WHERE page_id=NEW.page_id AND id=NEW.parent_id AND language=NEW.language) THEN
  RAISE EXCEPTION 'Wiki parent must already exist in this page and language' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER wiki_revision_parent BEFORE INSERT ON public.wiki_revision FOR EACH ROW EXECUTE FUNCTION public.wiki_revision_guard();
CREATE OR REPLACE TRIGGER wiki_revision_immutable BEFORE UPDATE ON public.wiki_revision FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER wiki_payload_immutable BEFORE UPDATE ON public.wiki_revision_payload FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.wiki_selection_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.wiki_page WHERE id=NEW.page_id AND state<>'erased' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wiki page is unavailable' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.wiki_revision_payload WHERE page_id=NEW.page_id AND revision_id=NEW.revision_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wiki payload is unavailable' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.page_id<>OLD.page_id OR NEW.language<>OLD.language OR NEW.version<>OLD.version+1)) THEN
  RAISE EXCEPTION 'Wiki selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER wiki_head_guard BEFORE INSERT OR UPDATE ON public.wiki_head FOR EACH ROW EXECUTE FUNCTION public.wiki_selection_guard();
CREATE OR REPLACE TRIGGER wiki_selection_guard BEFORE INSERT OR UPDATE ON public.wiki_selection FOR EACH ROW EXECUTE FUNCTION public.wiki_selection_guard();

CREATE OR REPLACE FUNCTION public.description_meaning_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.description_revision revision
 JOIN public.schema_model_release model ON model.id=revision.model_id
 CROSS JOIN jsonb_array_elements(model.body->'sourceReleases') source
 JOIN public.schema_release_term meaning ON meaning.release_id=(source->>'id')::uuid
 WHERE revision.object_id=NEW.object_id AND revision.id=NEW.revision_id AND revision.payload_state='available'
 AND meaning.term_id=NEW.predicate_id AND meaning.definition_id=NEW.definition_id)
 THEN RAISE EXCEPTION 'Statement meaning is outside the pinned revision model' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER description_meaning_guard BEFORE INSERT ON public.description_statement FOR EACH ROW EXECUTE FUNCTION public.description_meaning_guard();
