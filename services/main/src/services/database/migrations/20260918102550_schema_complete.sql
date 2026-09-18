SET search_path TO public;

CREATE TABLE "assertion_assessment" (
	"id" uuid PRIMARY KEY,
	"object_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"statement_id" uuid NOT NULL,
	"issuer_user_id" uuid,
	"method_iri" text NOT NULL,
	"method_version" text NOT NULL,
	"verdict" text NOT NULL,
	"evidence_digest" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assertion_assessment_verdict" CHECK ("verdict" in ('supported','refuted','disputed','abstained','unavailable'))
);

CREATE TABLE "catalog_definition_binding" (
	"definition_revision_id" uuid PRIMARY KEY,
	"term_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"contract" jsonb NOT NULL,
	CONSTRAINT "catalog_definition_binding_relation_check" CHECK ("relation" in ('exact','specialization','transformation') and jsonb_typeof("contract")='object')
);

CREATE TABLE "complimentary_award" (
	"id" uuid PRIMARY KEY,
	"beneficiary_user_id" uuid NOT NULL,
	"issuer_entity_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"receipt_key" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complimentary_award_retry" UNIQUE("issuer_entity_id","receipt_key"),
	CONSTRAINT "complimentary_award_beneficiary" UNIQUE("id","beneficiary_user_id")
);

CREATE TABLE "contributor_award" (
	"id" uuid PRIMARY KEY,
	"beneficiary_user_id" uuid NOT NULL,
	"issuer_entity_id" uuid NOT NULL,
	"contribution_ref_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributor_award_decision" UNIQUE("issuer_entity_id","decision_id"),
	CONSTRAINT "contributor_award_beneficiary" UNIQUE("id","beneficiary_user_id")
);

CREATE TABLE "conversation_member" (
	"conversation_id" uuid,
	"user_id" uuid,
	"entity_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp(3) with time zone NOT NULL,
	"history_from" timestamp(3) with time zone NOT NULL,
	"left_at" timestamp(3) with time zone,
	"revision" bigint NOT NULL,
	CONSTRAINT "conversation_member_pkey" PRIMARY KEY("conversation_id","user_id"),
	CONSTRAINT "conversation_member_role" CHECK ("role" in ('member','moderator','owner') and "revision">0)
);

CREATE TABLE "description_change" (
	"id" uuid PRIMARY KEY,
	"object_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"nonce" text NOT NULL,
	"payload_digest" text NOT NULL,
	"summary" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "description_change_scope" UNIQUE("id","object_id"),
	CONSTRAINT "description_change_receipt" UNIQUE("object_id","nonce")
);

CREATE TABLE "description_evidence" (
	"object_id" uuid,
	"revision_id" uuid,
	"statement_id" uuid,
	"id" uuid,
	"source_uri" text,
	"snapshot_blob_id" uuid,
	"selector" jsonb,
	CONSTRAINT "description_evidence_pkey" PRIMARY KEY("object_id","revision_id","statement_id","id"),
	CONSTRAINT "description_evidence_reference" CHECK (num_nonnulls("source_uri","snapshot_blob_id")>0)
);

CREATE TABLE "description_object" (
	"id" uuid PRIMARY KEY,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"visibility" text NOT NULL,
	"state" text NOT NULL,
	"control_revision" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "description_object_state" CHECK ("visibility" in ('public','unlisted','private') and "state" in ('draft','published','withdrawn','erased') and "control_revision">0)
);

CREATE TABLE "description_revision" (
	"object_id" uuid,
	"id" uuid,
	"parent_id" uuid,
	"change_id" uuid NOT NULL,
	"payload_state" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "description_revision_pkey" PRIMARY KEY("object_id","id"),
	CONSTRAINT "description_revision_payload" CHECK ("payload_state" in ('available','erased'))
);

CREATE TABLE "description_selection" (
	"object_id" uuid PRIMARY KEY,
	"revision_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"change_id" uuid NOT NULL,
	CONSTRAINT "description_selection_version" CHECK ("version">0)
);

CREATE TABLE "description_statement" (
	"object_id" uuid,
	"revision_id" uuid,
	"id" uuid,
	"predicate_id" uuid NOT NULL,
	"state" text NOT NULL,
	"datatype_id" uuid,
	"lexical" text,
	"language" text,
	"value_hash" text,
	"native_target_ref_id" uuid,
	"description_target_id" uuid,
	"external_iri" text,
	"order_key" text,
	CONSTRAINT "description_statement_pkey" PRIMARY KEY("object_id","revision_id","id"),
	CONSTRAINT "description_statement_value" CHECK (("state"='literal' and "datatype_id" is not null and "lexical" is not null and "value_hash" is not null and num_nonnulls("native_target_ref_id","description_target_id","external_iri")=0)
 or ("state"='reference' and num_nonnulls("native_target_ref_id","description_target_id","external_iri")=1 and num_nonnulls("datatype_id","lexical","language","value_hash")=0)
 or ("state" in ('unknown','no-value') and num_nonnulls("native_target_ref_id","description_target_id","external_iri","datatype_id","lexical","language","value_hash")=0))
);

CREATE TABLE "description_type" (
	"object_id" uuid,
	"revision_id" uuid,
	"type_id" uuid,
	CONSTRAINT "description_type_pkey" PRIMARY KEY("object_id","revision_id","type_id")
);

CREATE TABLE "entitlement_benefit_head" (
	"beneficiary_user_id" uuid,
	"benefit_id" uuid,
	"scope_ref_id" uuid,
	"revision" bigint NOT NULL,
	"complete" boolean NOT NULL,
	"active" boolean NOT NULL,
	"next_boundary_at" timestamp with time zone,
	CONSTRAINT "entitlement_benefit_head_pkey" PRIMARY KEY("beneficiary_user_id","benefit_id","scope_ref_id")
);

CREATE TABLE "entitlement_grant" (
	"id" uuid PRIMARY KEY,
	"beneficiary_user_id" uuid NOT NULL,
	"benefit_id" uuid NOT NULL,
	"benefit_revision_id" uuid NOT NULL,
	"scope_ref_id" uuid NOT NULL,
	"agreement_id" uuid,
	"complimentary_award_id" uuid,
	"contributor_award_id" uuid,
	CONSTRAINT "entitlement_grant_one_source" CHECK (num_nonnulls("agreement_id","complimentary_award_id","contributor_award_id")=1)
);

CREATE TABLE "entitlement_grant_revision" (
	"grant_id" uuid,
	"revision" bigint,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"reason" text NOT NULL,
	CONSTRAINT "entitlement_grant_revision_pkey" PRIMARY KEY("grant_id","revision"),
	CONSTRAINT "entitlement_grant_interval" CHECK ("revision">0 and ("ends_at" is null or "ends_at">"starts_at"))
);

CREATE TABLE "media_blob" (
	"id" uuid PRIMARY KEY,
	"storage_domain" text NOT NULL,
	"algorithm" text NOT NULL,
	"digest" text NOT NULL,
	"byte_length" numeric(40,0) NOT NULL,
	"availability" text NOT NULL,
	"erasure_epoch" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "media_blob_domain_digest" UNIQUE("storage_domain","algorithm","digest"),
	CONSTRAINT "media_blob_bytes" CHECK ("byte_length">=0),
	CONSTRAINT "media_blob_availability" CHECK ("availability" in ('observed','stored','unavailable','erased'))
);

CREATE TABLE "media_blob_location" (
	"blob_id" uuid,
	"id" uuid,
	"backend" text NOT NULL,
	"object_key" text NOT NULL,
	"object_version" text,
	"state" text NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "media_blob_location_pkey" PRIMARY KEY("blob_id","id"),
	CONSTRAINT "media_blob_location_state" CHECK ("state" in ('pending','ready','unavailable','erased'))
);

CREATE TABLE "media_fetch_state" (
	"locator_id" uuid PRIMARY KEY,
	"next_attempt_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"attempt" integer DEFAULT 0 NOT NULL,
	"last_observation_id" uuid,
	CONSTRAINT "media_fetch_attempt" CHECK ("attempt">=0),
	CONSTRAINT "media_fetch_lease" CHECK (num_nonnulls("lease_token","lease_until") in (0,2))
);

CREATE TABLE "media_fingerprint" (
	"media_id" uuid NOT NULL,
	"representation_id" uuid,
	"algorithm" text,
	"version" text,
	"digest" text NOT NULL,
	CONSTRAINT "media_fingerprint_pkey" PRIMARY KEY("representation_id","algorithm","version")
);

CREATE TABLE "media_fragment" (
	"id" uuid PRIMARY KEY,
	"representation_id" uuid NOT NULL,
	"start_ticks" numeric(40,0),
	"end_ticks" numeric(40,0),
	"time_scale" integer,
	"x" numeric,
	"y" numeric,
	"width" numeric,
	"height" numeric,
	"coordinate_unit" text,
	"selector_uri" text,
	CONSTRAINT "media_fragment_id_representation" UNIQUE("id","representation_id"),
	CONSTRAINT "media_fragment_percent" CHECK ("coordinate_unit" is distinct from 'percent' or ("x"+"width"<=100 and "y"+"height"<=100)),
	CONSTRAINT "media_fragment_time" CHECK (num_nonnulls("start_ticks","end_ticks","time_scale") in (0,3) and ("time_scale" is null or ("time_scale">0 and "start_ticks">=0 and "end_ticks">="start_ticks"))),
	CONSTRAINT "media_fragment_space" CHECK (num_nonnulls("x","y","width","height","coordinate_unit") in (0,5) and ("coordinate_unit" is null or ("coordinate_unit" in ('pixel','percent') and "x">=0 and "y">=0 and "width">0 and "height">0)))
);

CREATE TABLE "media_index_entry" (
	"generation_id" uuid,
	"media_id" uuid,
	"metadata_revision_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "media_index_entry_pkey" PRIMARY KEY("generation_id","media_id")
);

CREATE TABLE "media_index_generation" (
	"id" uuid PRIMARY KEY,
	"kind" text NOT NULL,
	"state" text NOT NULL,
	"input_manifest_hash" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_index_generation_state" CHECK ("state" in ('building','sealed','active','retired','failed'))
);

CREATE TABLE "media_item" (
	"id" uuid PRIMARY KEY,
	"kind" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "media_item_kind" CHECK ("kind" in ('image','video','audio')),
	CONSTRAINT "media_item_state" CHECK ("state" in ('active','withdrawn','erased')),
	CONSTRAINT "media_item_revision" CHECK ("revision">0)
);

CREATE TABLE "media_locator" (
	"id" uuid PRIMARY KEY,
	"media_id" uuid NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"provider" text,
	"external_key" text,
	"first_observed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_locator_id_media" UNIQUE("id","media_id"),
	CONSTRAINT "media_locator_hash" CHECK (encode(sha256(convert_to("url",'UTF8')),'hex')="url_hash")
);

CREATE TABLE "media_metadata_revision" (
	"media_id" uuid,
	"id" uuid,
	"parent_id" uuid,
	"creator_entity_id" uuid,
	"fields" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_metadata_revision_pkey" PRIMARY KEY("media_id","id"),
	CONSTRAINT "media_metadata_shape" CHECK (jsonb_typeof("fields")='object' and jsonb_typeof("evidence")='array')
);

CREATE TABLE "media_metadata_selection" (
	"media_id" uuid PRIMARY KEY,
	"revision_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"selected_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_metadata_selection_version" CHECK ("version">0)
);

CREATE TABLE "media_observation" (
	"id" uuid PRIMARY KEY,
	"media_id" uuid NOT NULL,
	"locator_id" uuid,
	"observed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"content_hash" text,
	"etag" text,
	"mime_type" text,
	"byte_length" numeric(40,0),
	"artifact_blob_id" uuid,
	"evidence_uri" text,
	CONSTRAINT "media_observation_id_media" UNIQUE("id","media_id"),
	CONSTRAINT "media_observation_id_locator" UNIQUE("id","locator_id"),
	CONSTRAINT "media_observation_status" CHECK ("status" in ('available','unavailable','forbidden','unknown')),
	CONSTRAINT "media_observation_bytes" CHECK ("byte_length" is null or "byte_length">=0)
);

CREATE TABLE "media_occurrence" (
	"id" uuid PRIMARY KEY,
	"media_id" uuid NOT NULL,
	"page_uri" text NOT NULL,
	"page_uri_hash" text NOT NULL,
	"page_revision" text NOT NULL,
	"selector" text NOT NULL,
	"selector_hash" text NOT NULL,
	"observation_id" uuid,
	"observed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_occurrence_page_location" UNIQUE("page_uri_hash","page_revision","selector_hash","media_id")
);

CREATE TABLE "media_representation" (
	"id" uuid PRIMARY KEY,
	"media_id" uuid NOT NULL,
	"observation_id" uuid,
	"blob_id" uuid,
	"mime_type" text NOT NULL,
	"codec" text,
	"width" numeric(40,0),
	"height" numeric(40,0),
	"duration_ticks" numeric(40,0),
	"time_scale" integer,
	"channels" integer,
	"sample_rate" integer,
	"byte_length" numeric(40,0),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_representation_id_media" UNIQUE("id","media_id"),
	CONSTRAINT "media_representation_values" CHECK (("byte_length" is null or "byte_length">=0) and ("channels" is null or "channels">0) and ("sample_rate" is null or "sample_rate">0)),
	CONSTRAINT "media_representation_dimensions" CHECK (("width" is null or "width">0) and ("height" is null or "height">0)),
	CONSTRAINT "media_representation_time" CHECK (num_nonnulls("duration_ticks","time_scale") in (0,2) and ("duration_ticks" is null or ("duration_ticks">=0 and "time_scale">0)))
);

CREATE TABLE "media_selection_head" (
	"slot_id" uuid PRIMARY KEY,
	"revision_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	CONSTRAINT "media_selection_head_version" CHECK ("version">0)
);

CREATE TABLE "media_selection_member" (
	"slot_id" uuid,
	"selection_revision_id" uuid,
	"position" integer,
	"subject_ref_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"use_id" uuid NOT NULL,
	"use_revision_id" uuid NOT NULL,
	CONSTRAINT "media_selection_member_pkey" PRIMARY KEY("slot_id","selection_revision_id","position"),
	CONSTRAINT "media_selection_position" CHECK ("position" between 0 and 1023)
);

CREATE TABLE "media_selection_revision" (
	"slot_id" uuid,
	"id" uuid,
	"sealed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "media_selection_revision_pkey" PRIMARY KEY("slot_id","id")
);

CREATE TABLE "media_slot" (
	"id" uuid PRIMARY KEY,
	"subject_ref_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"language" text DEFAULT '' NOT NULL,
	"context_key" text DEFAULT '' NOT NULL,
	"minimum" integer DEFAULT 0 NOT NULL,
	"maximum" integer NOT NULL,
	CONSTRAINT "media_slot_scope" UNIQUE("subject_ref_id","role_id","language","context_key"),
	CONSTRAINT "media_slot_subject_role" UNIQUE("id","subject_ref_id","role_id"),
	CONSTRAINT "media_slot_cardinality" CHECK ("minimum">=0 and "maximum">="minimum" and "maximum"<=1024)
);

CREATE TABLE "media_stream" (
	"representation_id" uuid,
	"ordinal" integer,
	"kind" text NOT NULL,
	"codec" text,
	"language" text,
	"duration_ticks" numeric(40,0),
	"time_scale" integer,
	CONSTRAINT "media_stream_pkey" PRIMARY KEY("representation_id","ordinal"),
	CONSTRAINT "media_stream_time" CHECK (num_nonnulls("duration_ticks","time_scale") in (0,2) and ("duration_ticks" is null or ("duration_ticks">=0 and "time_scale">0))),
	CONSTRAINT "media_stream_kind" CHECK ("kind" in ('video','audio','subtitle','data') and "ordinal">=0)
);

CREATE TABLE "media_use" (
	"id" uuid PRIMARY KEY,
	"subject_ref_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "media_use_id_media" UNIQUE("id","media_id"),
	CONSTRAINT "media_use_subject_role" UNIQUE("id","subject_ref_id","role_id")
);

CREATE TABLE "media_use_revision" (
	"use_id" uuid,
	"id" uuid,
	"media_id" uuid NOT NULL,
	"representation_id" uuid,
	"fragment_id" uuid,
	"language" text,
	"caption" text,
	"source_uri" text,
	CONSTRAINT "media_use_revision_pkey" PRIMARY KEY("use_id","id"),
	CONSTRAINT "media_use_fragment_representation" CHECK ("fragment_id" is null or "representation_id" is not null)
);

CREATE TABLE "message_attachment" (
	"conversation_id" uuid,
	"message_id" uuid,
	"id" uuid,
	"representation_id" uuid NOT NULL,
	"caption" text,
	CONSTRAINT "message_attachment_pkey" PRIMARY KEY("conversation_id","message_id","id")
);

CREATE TABLE "message_delivery_receipt" (
	"conversation_id" uuid,
	"message_id" uuid,
	"recipient_user_id" uuid,
	"delivered_at" timestamp(3) with time zone,
	"read_at" timestamp(3) with time zone,
	CONSTRAINT "message_delivery_receipt_pkey" PRIMARY KEY("conversation_id","message_id","recipient_user_id"),
	CONSTRAINT "message_receipt_order" CHECK ("read_at" is null or ("delivered_at" is not null and "read_at">="delivered_at"))
);

CREATE TABLE "message_revision" (
	"conversation_id" uuid,
	"message_id" uuid,
	"revision" bigint,
	"content" text,
	"valid_from" timestamp(3) with time zone NOT NULL,
	"closed_at" timestamp(3) with time zone NOT NULL,
	"erased_at" timestamp(3) with time zone,
	CONSTRAINT "message_revision_pkey" PRIMARY KEY("conversation_id","message_id","revision"),
	CONSTRAINT "message_revision_state" CHECK ("revision">0 and (("erased_at" is null and "content" is not null) or ("erased_at" is not null and "content" is null)))
);

CREATE TABLE "participation_meter" (
	"id" uuid PRIMARY KEY,
	"realm_id" uuid NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"unit" text NOT NULL,
	"window_key" text NOT NULL,
	"balance" numeric(40,0) NOT NULL,
	"revision" bigint NOT NULL,
	CONSTRAINT "participation_meter_scope" UNIQUE("realm_id","beneficiary_user_id","action","unit","window_key")
);

CREATE TABLE "participation_meter_entry" (
	"meter_id" uuid,
	"id" uuid,
	"operation_key" text NOT NULL,
	"delta" numeric(40,0) NOT NULL,
	"compensates_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participation_meter_entry_pkey" PRIMARY KEY("meter_id","id"),
	CONSTRAINT "participation_meter_effect" UNIQUE("meter_id","operation_key"),
	CONSTRAINT "participation_meter_compensation" UNIQUE("meter_id","compensates_id")
);

CREATE TABLE "participation_review_attempt" (
	"submission_id" uuid,
	"id" uuid,
	"policy_revision_id" uuid NOT NULL,
	"target_revision_id" uuid NOT NULL,
	"lease_token" uuid NOT NULL,
	"state" text NOT NULL,
	"findings" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participation_review_attempt_pkey" PRIMARY KEY("submission_id","id")
);

CREATE TABLE "participation_submission" (
	"id" uuid PRIMARY KEY,
	"realm_id" uuid NOT NULL,
	"policy_revision_id" uuid NOT NULL,
	"target_ref_id" uuid NOT NULL,
	"target_revision_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"state" text NOT NULL,
	"revision" bigint NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participation_submission_exact" UNIQUE("id","policy_revision_id","target_revision_id")
);

CREATE TABLE "realm_participation_policy" (
	"realm_id" uuid PRIMARY KEY,
	"revision" bigint NOT NULL,
	"current_revision_id" uuid
);

CREATE TABLE "realm_participation_policy_revision" (
	"realm_id" uuid,
	"id" uuid,
	"revision" bigint NOT NULL,
	"admission" jsonb NOT NULL,
	"metering" jsonb NOT NULL,
	"review" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_participation_policy_revision_pkey" PRIMARY KEY("realm_id","id"),
	CONSTRAINT "realm_participation_policy_version" UNIQUE("realm_id","revision")
);

CREATE TABLE "registry_capability_declaration" (
	"package_id" uuid,
	"release_id" uuid,
	"capability" text,
	"contract" jsonb NOT NULL,
	CONSTRAINT "registry_capability_declaration_pkey" PRIMARY KEY("package_id","release_id","capability")
);

CREATE TABLE "registry_dependency" (
	"package_id" uuid,
	"release_id" uuid,
	"dependency_package_id" uuid,
	"range" text NOT NULL,
	"resolved_release_id" uuid,
	CONSTRAINT "registry_dependency_pkey" PRIMARY KEY("package_id","release_id","dependency_package_id")
);

CREATE TABLE "registry_file" (
	"package_id" uuid,
	"release_id" uuid,
	"path" text,
	"blob_id" uuid NOT NULL,
	"media_type" text NOT NULL,
	CONSTRAINT "registry_file_pkey" PRIMARY KEY("package_id","release_id","path"),
	CONSTRAINT "registry_file_path" CHECK ("path"<>'' and "path" not like '/%' and "path" !~ '(^|/)..(/|$)')
);

CREATE TABLE "registry_installation" (
	"id" uuid PRIMARY KEY,
	"owner_entity_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"state" text NOT NULL,
	"revision" bigint NOT NULL,
	CONSTRAINT "registry_installation_state" CHECK ("state" in ('installed','disabled','removed') and "revision">0)
);

CREATE TABLE "registry_package" (
	"id" uuid PRIMARY KEY,
	"ecosystem" text NOT NULL,
	"namespace" text NOT NULL,
	"name" text NOT NULL,
	"work_id" uuid,
	"kind" text NOT NULL,
	CONSTRAINT "registry_package_coordinate" UNIQUE("ecosystem","namespace","name"),
	CONSTRAINT "registry_package_kind" CHECK ("kind" in ('software','skill','prompt','mcp','plugin','model'))
);

CREATE TABLE "registry_release" (
	"package_id" uuid,
	"id" uuid,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"state" text NOT NULL,
	CONSTRAINT "registry_release_pkey" PRIMARY KEY("package_id","id"),
	CONSTRAINT "registry_release_version" UNIQUE("package_id","version"),
	CONSTRAINT "registry_release_state" CHECK ("state" in ('draft','published','withdrawn'))
);

CREATE TABLE "schema_change" (
	"id" uuid PRIMARY KEY,
	"actor" jsonb,
	"message" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_change_message_bound" CHECK (octet_length("message") between 1 and 16384),
	CONSTRAINT "schema_change_actor" CHECK ("actor" is null or coalesce(jsonb_typeof("actor") = 'object' and "actor"->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$' and "actor"->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false))
);

CREATE TABLE "schema_contract" (
	"id" uuid PRIMARY KEY,
	"source" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"origin" text NOT NULL,
	"dialect" text NOT NULL,
	CONSTRAINT "schema_contract_version_key" UNIQUE("source","name","version","digest")
);

CREATE TABLE "schema_contract_field" (
	"contract_id" uuid,
	"id" uuid,
	"path" text NOT NULL,
	"path_hash" text NOT NULL,
	"shape" text NOT NULL,
	"required" text NOT NULL,
	"cardinality" text NOT NULL,
	"nullability" text NOT NULL,
	CONSTRAINT "schema_contract_field_pkey" PRIMARY KEY("contract_id","id"),
	CONSTRAINT "schema_contract_field_path_key" UNIQUE("contract_id","path_hash"),
	CONSTRAINT "schema_contract_field_states" CHECK ("required" in ('yes','no','unspecified') and "cardinality" in ('one','many','unspecified') and "nullability" in ('nullable','non-null','unspecified'))
);

CREATE TABLE "schema_contract_keyword" (
	"contract_id" uuid,
	"field_id" uuid,
	"position" integer,
	"keyword" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "schema_contract_keyword_pkey" PRIMARY KEY("contract_id","field_id","position"),
	CONSTRAINT "schema_contract_keyword_position" CHECK ("position">=0)
);

CREATE TABLE "schema_contract_reference" (
	"contract_id" uuid,
	"field_id" uuid,
	"position" integer,
	"kind" text NOT NULL,
	"reference" text NOT NULL,
	"target_contract_id" uuid,
	"target_path" text,
	CONSTRAINT "schema_contract_reference_pkey" PRIMARY KEY("contract_id","field_id","position")
);

CREATE TABLE "schema_definition" (
	"id" uuid PRIMARY KEY,
	"term_id" uuid NOT NULL,
	"vocabulary_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"canonical" text NOT NULL,
	"types" jsonb NOT NULL,
	"status" text NOT NULL,
	"replacements" jsonb NOT NULL,
	CONSTRAINT "schema_definition_term_id" UNIQUE("id","term_id"),
	CONSTRAINT "schema_definition_origin" UNIQUE("id","term_id","vocabulary_id"),
	CONSTRAINT "schema_definition_content" UNIQUE("term_id","vocabulary_id","digest"),
	CONSTRAINT "schema_definition_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$' and "status" in ('active','pending','retired') and jsonb_typeof("types") = 'array' and jsonb_typeof("replacements") = 'array')
);

CREATE TABLE "schema_label" (
	"id" uuid PRIMARY KEY,
	"term_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"value" text NOT NULL,
	"language" text NOT NULL,
	"datatype" text NOT NULL,
	CONSTRAINT "schema_label_term_language" UNIQUE("id","term_id","language"),
	CONSTRAINT "schema_label_term" UNIQUE("id","term_id")
);

CREATE TABLE "schema_label_selection" (
	"id" uuid PRIMARY KEY,
	"term_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"change_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_label_selection_version" UNIQUE("term_id","language","version"),
	CONSTRAINT "schema_label_selection_version_positive" CHECK ("version" between 1 and 9007199254740991)
);

CREATE TABLE "schema_node" (
	"release_id" uuid,
	"id" uuid,
	"kind" text NOT NULL,
	"term_id" uuid,
	"lexical" text NOT NULL,
	"datatype_id" uuid,
	"language" text,
	CONSTRAINT "schema_node_pkey" PRIMARY KEY("release_id","id"),
	CONSTRAINT "schema_node_kind_check" CHECK (("kind"='iri' and "term_id" is not null and "datatype_id" is null and "language" is null)
 or ("kind"='blank' and "term_id" is null and "datatype_id" is null and "language" is null)
 or ("kind"='literal' and "term_id" is null and "datatype_id" is not null)
 or ("kind"='default-graph' and "lexical"='' and num_nonnulls("term_id","datatype_id","language")=0))
);

CREATE TABLE "schema_profile" (
	"id" uuid PRIMARY KEY,
	"key" text NOT NULL CONSTRAINT "schema_profile_key" UNIQUE
);

CREATE TABLE "schema_profile_revision" (
	"id" uuid PRIMARY KEY,
	"profile_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "schema_profile_revision_digest" UNIQUE("profile_id","digest"),
	CONSTRAINT "schema_profile_revision_body" CHECK (jsonb_typeof("body") = 'object')
);

CREATE TABLE "schema_profile_rule" (
	"profile_revision_id" uuid,
	"predicate_id" uuid,
	"definition_id" uuid NOT NULL,
	CONSTRAINT "schema_profile_rule_pkey" PRIMARY KEY("profile_revision_id","predicate_id")
);

CREATE TABLE "schema_relation" (
	"id" uuid PRIMARY KEY,
	"subject_owner" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_relation_owner" CHECK ("subject_owner" ~ '^[a-z][a-z0-9_.-]{0,95}$')
);

CREATE TABLE "schema_relation_revision" (
	"id" uuid PRIMARY KEY,
	"relation_id" uuid NOT NULL,
	"predicate_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"subject_revision_id" uuid,
	"parent_revision_id" uuid,
	"change_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"position" numeric,
	"digest" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_revision_relation" UNIQUE("id","relation_id"),
	CONSTRAINT "schema_revision_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$' and ("position" is null or ("position" >= 0 and "position" < 1e40 and scale("position") = 0)) and jsonb_typeof("value") = 'object' and "value"->>'kind' in ('reference','iri','literal','unknown','no-value')),
	CONSTRAINT "schema_revision_not_self_parent" CHECK ("parent_revision_id" is null or "parent_revision_id" <> "id"),
	CONSTRAINT "schema_revision_value" CHECK (coalesce(octet_length("value"::text) <= 524288 and case "value"->>'kind'
			when 'reference' then jsonb_typeof("value"->'reference') = 'object'
				and "value"->'reference'->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$'
				and "value"->'reference'->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
				and (not ("value"->'reference' ? 'revisionId') or "value"->'reference'->>'revisionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
			when 'iri' then jsonb_typeof("value"->'iri') = 'string' and "value"->>'iri' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'
			when 'literal' then jsonb_typeof("value"->'value') = 'string' and jsonb_typeof("value"->'datatype') = 'string'
				and "value"->>'datatype' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'
				and ("value"->>'datatype' = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString') = ("value" ? 'language')
				and (not ("value" ? 'language') or "value"->>'language' ~* '^[a-z]+(-[a-z0-9]+)*$')
			when 'unknown' then true when 'no-value' then true else false end, false))
);

CREATE TABLE "schema_relation_selection" (
	"id" uuid PRIMARY KEY,
	"relation_id" uuid NOT NULL,
	"revision_id" uuid,
	"version" bigint NOT NULL,
	"change_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_selection_version" UNIQUE("relation_id","version"),
	CONSTRAINT "schema_selection_version_positive" CHECK ("version" between 1 and 9007199254740991)
);

CREATE TABLE "schema_release" (
	"id" uuid PRIMARY KEY,
	"vocabulary_id" uuid NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"source" jsonb NOT NULL,
	"source_bytes" bytea NOT NULL,
	"canonical" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_release_vocabulary_id" UNIQUE("id","vocabulary_id"),
	CONSTRAINT "schema_release_content" UNIQUE("vocabulary_id","digest"),
	CONSTRAINT "schema_release_digest_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "schema_release_source_bound" CHECK (octet_length("source_bytes") <= 16777216 and jsonb_typeof("source") = 'object'),
	CONSTRAINT "schema_release_source_digest" CHECK (coalesce(encode(sha256("source_bytes"), 'hex') = "source"->>'sha256', false))
);

CREATE TABLE "schema_release_context" (
	"release_id" uuid,
	"sha256" text,
	"bytes" bytea NOT NULL,
	CONSTRAINT "schema_release_context_pkey" PRIMARY KEY("release_id","sha256"),
	CONSTRAINT "schema_release_context_bound" CHECK (octet_length("bytes") <= 1048576 and encode(sha256("bytes"), 'hex') = "sha256")
);

CREATE TABLE "schema_release_label" (
	"release_id" uuid,
	"term_id" uuid,
	"label_id" uuid,
	CONSTRAINT "schema_release_label_pkey" PRIMARY KEY("release_id","term_id","label_id")
);

CREATE TABLE "schema_release_term" (
	"release_id" uuid,
	"vocabulary_id" uuid NOT NULL,
	"term_id" uuid,
	"definition_id" uuid NOT NULL,
	CONSTRAINT "schema_release_term_pkey" PRIMARY KEY("release_id","term_id")
);

CREATE TABLE "schema_statement" (
	"release_id" uuid,
	"id" uuid,
	"subject_id" uuid NOT NULL,
	"predicate_id" uuid NOT NULL,
	"predicate_iri" text NOT NULL,
	"object_id" uuid NOT NULL,
	"graph_id" uuid NOT NULL,
	CONSTRAINT "schema_statement_pkey" PRIMARY KEY("release_id","id"),
	CONSTRAINT "schema_statement_quad_key" UNIQUE("release_id","subject_id","predicate_iri","object_id","graph_id")
);

CREATE TABLE "schema_term" (
	"id" uuid PRIMARY KEY,
	"iri" text NOT NULL,
	"iri_hash" text NOT NULL CONSTRAINT "schema_term_iri_hash" UNIQUE,
	CONSTRAINT "schema_term_iri_bounds" CHECK (octet_length("iri") between 1 and 262144 and encode(sha256(convert_to("iri", 'UTF8')), 'hex') = "iri_hash")
);

CREATE TABLE "schema_term_alias" (
	"iri_hash" text PRIMARY KEY,
	"iri" text NOT NULL,
	"term_id" uuid NOT NULL,
	CONSTRAINT "schema_term_alias_hash" CHECK (encode(sha256(convert_to("iri", 'UTF8')), 'hex') = "iri_hash")
);

CREATE TABLE "schema_vocabulary" (
	"id" uuid PRIMARY KEY,
	"key" text NOT NULL CONSTRAINT "schema_vocabulary_key" UNIQUE,
	CONSTRAINT "schema_vocabulary_key_shape" CHECK ("key" ~ '^[a-z][a-z0-9-]{0,63}$')
);

CREATE TABLE "schema_vocabulary_head" (
	"vocabulary_id" uuid PRIMARY KEY,
	"release_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	CONSTRAINT "schema_vocabulary_head_version" CHECK ("version" between 1 and 9007199254740991)
);

CREATE TABLE "subscription_agreement" (
	"id" uuid PRIMARY KEY,
	"beneficiary_user_id" uuid NOT NULL,
	"payer_user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account" text NOT NULL,
	"environment" text NOT NULL,
	"external_id" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_agreement_provider" UNIQUE("provider","provider_account","environment","external_id"),
	CONSTRAINT "subscription_agreement_beneficiary" UNIQUE("id","beneficiary_user_id")
);

CREATE TABLE "subscription_agreement_revision" (
	"agreement_id" uuid,
	"id" uuid,
	"plan_id" uuid NOT NULL,
	"plan_revision_id" uuid NOT NULL,
	"price_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"renew" boolean NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_agreement_revision_pkey" PRIMARY KEY("agreement_id","id"),
	CONSTRAINT "subscription_agreement_interval" CHECK ("ends_at" is null or "ends_at">"starts_at")
);

CREATE TABLE "subscription_benefit" (
	"id" uuid PRIMARY KEY,
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "subscription_benefit_key" UNIQUE("namespace","key"),
	CONSTRAINT "subscription_benefit_kind" CHECK ("kind" in ('audience','quota','content','participation'))
);

CREATE TABLE "subscription_benefit_binding" (
	"plan_id" uuid,
	"plan_revision_id" uuid,
	"benefit_id" uuid,
	"benefit_revision_id" uuid NOT NULL,
	"scope_ref_id" uuid,
	CONSTRAINT "subscription_benefit_binding_pkey" PRIMARY KEY("plan_id","plan_revision_id","benefit_id","scope_ref_id")
);

CREATE TABLE "subscription_benefit_revision" (
	"benefit_id" uuid,
	"id" uuid,
	"revision" bigint NOT NULL,
	"contract" jsonb NOT NULL,
	CONSTRAINT "subscription_benefit_revision_pkey" PRIMARY KEY("benefit_id","id"),
	CONSTRAINT "subscription_benefit_revision_number" UNIQUE("benefit_id","revision")
);

CREATE TABLE "subscription_offering" (
	"id" uuid PRIMARY KEY,
	"target_ref_id" uuid NOT NULL,
	"operator_entity_id" uuid NOT NULL,
	"state" text NOT NULL,
	"revision" bigint NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_offering_state" CHECK ("state" in ('draft','active','retired') and "revision">0)
);

CREATE TABLE "subscription_operation" (
	"id" uuid PRIMARY KEY,
	"actor_user_id" uuid NOT NULL,
	"nonce" text NOT NULL,
	"payload_digest" text NOT NULL,
	"agreement_id" uuid,
	"state" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_operation_retry" UNIQUE("actor_user_id","nonce"),
	CONSTRAINT "subscription_operation_state" CHECK ("state" in ('prepared','pending','settled','failed','cancelled'))
);

CREATE TABLE "subscription_plan" (
	"id" uuid PRIMARY KEY,
	"offering_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"key" text NOT NULL,
	"state" text NOT NULL,
	CONSTRAINT "subscription_plan_key" UNIQUE("offering_id","key"),
	CONSTRAINT "subscription_plan_scope" UNIQUE("id","group_id","offering_id")
);

CREATE TABLE "subscription_plan_group" (
	"id" uuid PRIMARY KEY,
	"offering_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"revision" bigint NOT NULL,
	CONSTRAINT "subscription_group_offering" UNIQUE("id","offering_id"),
	CONSTRAINT "subscription_group_mode" CHECK ("mode" in ('replaceable','parallel') and "revision">0)
);

CREATE TABLE "subscription_plan_revision" (
	"plan_id" uuid,
	"id" uuid,
	"revision" bigint NOT NULL,
	"title" text NOT NULL,
	"terms" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plan_revision_pkey" PRIMARY KEY("plan_id","id"),
	CONSTRAINT "subscription_plan_revision_number" UNIQUE("plan_id","revision"),
	CONSTRAINT "subscription_plan_terms" CHECK ("revision">0 and jsonb_typeof("terms")='object')
);

CREATE TABLE "subscription_price" (
	"id" uuid PRIMARY KEY,
	"plan_id" uuid NOT NULL,
	"plan_revision_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"minor_units" numeric(40,0) NOT NULL,
	"interval_unit" text NOT NULL,
	"interval_count" integer NOT NULL,
	CONSTRAINT "subscription_price_plan" UNIQUE("id","plan_id","plan_revision_id"),
	CONSTRAINT "subscription_price_value" CHECK ("currency" ~ '^[A-Z]{3}$' and "minor_units">=0 and "interval_count">0 and "interval_unit" in ('day','week','month','year','one-time'))
);

CREATE TABLE "subscription_provider_effect" (
	"event_id" uuid,
	"effect" text,
	"agreement_id" uuid NOT NULL,
	"operation_id" uuid,
	"applied_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_provider_effect_pkey" PRIMARY KEY("event_id","effect")
);

CREATE TABLE "subscription_provider_event" (
	"id" uuid PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_account" text NOT NULL,
	"environment" text NOT NULL,
	"external_id" text NOT NULL,
	"digest" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "subscription_provider_event_key" UNIQUE("provider","provider_account","environment","external_id")
);

CREATE TABLE "wiki_address" (
	"namespace" text,
	"language" text,
	"path" text,
	"page_id" uuid NOT NULL,
	CONSTRAINT "wiki_address_pkey" PRIMARY KEY("namespace","language","path")
);

CREATE TABLE "wiki_head" (
	"page_id" uuid,
	"language" text,
	"branch" text,
	"revision_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	CONSTRAINT "wiki_head_pkey" PRIMARY KEY("page_id","language","branch"),
	CONSTRAINT "wiki_head_version" CHECK ("version">0)
);

CREATE TABLE "wiki_link" (
	"page_id" uuid,
	"revision_id" uuid,
	"id" uuid,
	"target_page_id" uuid,
	"external_iri" text,
	"selector" text,
	CONSTRAINT "wiki_link_pkey" PRIMARY KEY("page_id","revision_id","id"),
	CONSTRAINT "wiki_link_target" CHECK (num_nonnulls("target_page_id","external_iri")=1)
);

CREATE TABLE "wiki_page" (
	"id" uuid PRIMARY KEY,
	"realm_id" uuid,
	"subject_ref_id" uuid,
	"state" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_page_state" CHECK ("state" in ('draft','published','withdrawn','erased'))
);

CREATE TABLE "wiki_revision" (
	"page_id" uuid,
	"id" uuid,
	"language" text NOT NULL,
	"parent_id" uuid,
	"author_user_id" uuid,
	"summary" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_revision_pkey" PRIMARY KEY("page_id","id"),
	CONSTRAINT "wiki_revision_language" UNIQUE("page_id","id","language")
);

CREATE TABLE "wiki_revision_payload" (
	"page_id" uuid,
	"revision_id" uuid,
	"title" text NOT NULL,
	"format" text NOT NULL,
	"body" jsonb NOT NULL,
	"digest" text NOT NULL,
	CONSTRAINT "wiki_revision_payload_pkey" PRIMARY KEY("page_id","revision_id"),
	CONSTRAINT "wiki_payload_format" CHECK ("format" in ('portable-text','markdown','plain-text'))
);

CREATE TABLE "wiki_selection" (
	"page_id" uuid,
	"language" text,
	"revision_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"reviewed_by_user_id" uuid,
	"selected_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_selection_pkey" PRIMARY KEY("page_id","language"),
	CONSTRAINT "wiki_selection_version" CHECK ("version">0)
);

ALTER TABLE "conversation" ADD COLUMN "kind" text DEFAULT 'direct' NOT NULL;
ALTER TABLE "message" ADD COLUMN "revision" bigint DEFAULT 1 NOT NULL;
ALTER TABLE "reference_value" ADD COLUMN "target_description_id" uuid;
ALTER TABLE "reference_value" ADD COLUMN "target_wiki_id" uuid;
ALTER TABLE "reference_value" ADD COLUMN "target_indexed_media_id" uuid;
ALTER TABLE "reference_value" ADD COLUMN "target_vocabulary_term_id" uuid;
ALTER TABLE "reference_value" ADD COLUMN "target_semantic_relation_id" uuid;
ALTER TABLE "conversation" ALTER COLUMN "participant_low_entity_id" DROP NOT NULL;
ALTER TABLE "conversation" ALTER COLUMN "participant_high_entity_id" DROP NOT NULL;
ALTER TABLE "conversation" ALTER COLUMN "participant_low_auth_user_id" DROP NOT NULL;
ALTER TABLE "conversation" ALTER COLUMN "participant_high_auth_user_id" DROP NOT NULL;
DROP INDEX "reference_value_native_id_idx";
CREATE INDEX "reference_value_native_id_idx" ON "reference_value" (coalesce(coalesce("target_publishing_id", "target_music_id", "target_program_id", "target_software_id", "target_entity_id", "target_grouping_id", "target_reference_id", "target_distribution_id", "target_video_id", "target_audio_id", "target_post_id", "target_poll_id", "target_zone_id", "target_realm_id", "target_realm_rule_id", "target_custom_theme_id", "target_collection_id", "target_tag_id", "target_tag_path_id", "target_label_id"),"target_description_id","target_wiki_id","target_indexed_media_id","target_vocabulary_term_id","target_semantic_relation_id"));
ALTER TABLE "message" ADD CONSTRAINT "message_id_conversation_key" UNIQUE("id","conversation_id");
CREATE INDEX "assertion_assessment_target" ON "assertion_assessment" ("object_id","revision_id","statement_id","id");
CREATE INDEX "catalog_definition_binding_term_idx" ON "catalog_definition_binding" ("term_id","definition_revision_id");
CREATE INDEX "conversation_member_user" ON "conversation_member" ("user_id","conversation_id");
CREATE INDEX "description_statement_predicate" ON "description_statement" ("predicate_id","object_id","revision_id","id");
CREATE INDEX "description_statement_literal" ON "description_statement" ("predicate_id","datatype_id","value_hash","object_id");
CREATE INDEX "description_statement_native_reverse" ON "description_statement" ("native_target_ref_id","predicate_id","object_id");
CREATE INDEX "description_statement_description_reverse" ON "description_statement" ("description_target_id","predicate_id","object_id");
CREATE INDEX "description_type_reverse" ON "description_type" ("type_id","object_id","revision_id");
CREATE INDEX "entitlement_head_due" ON "entitlement_benefit_head" ("next_boundary_at","beneficiary_user_id");
CREATE INDEX "entitlement_grant_lookup" ON "entitlement_grant" ("beneficiary_user_id","benefit_id","scope_ref_id","id");
CREATE INDEX "media_blob_location_backend" ON "media_blob_location" ("backend","object_key");
CREATE INDEX "media_fetch_due_idx" ON "media_fetch_state" ("next_attempt_at","locator_id");
CREATE INDEX "media_fingerprint_lookup" ON "media_fingerprint" ("algorithm","version","digest");
CREATE INDEX "media_fragment_representation_idx" ON "media_fragment" ("representation_id","id");
CREATE INDEX "media_locator_url_idx" ON "media_locator" ("url_hash","id");
CREATE INDEX "media_locator_media_idx" ON "media_locator" ("media_id","id");
CREATE INDEX "media_observation_locator_time" ON "media_observation" ("locator_id","observed_at","id");
CREATE INDEX "media_occurrence_media_idx" ON "media_occurrence" ("media_id","id");
CREATE INDEX "media_representation_media_idx" ON "media_representation" ("media_id","id");
CREATE INDEX "media_use_subject" ON "media_use" ("subject_ref_id","role_id","id");
CREATE INDEX "media_use_media" ON "media_use" ("media_id","id");
CREATE INDEX "participation_submission_queue" ON "participation_submission" ("realm_id","state","created_at","id");
CREATE UNIQUE INDEX "reference_value_target_description_key" ON "reference_value" ("target_description_id") WHERE "target_description_id" is not null;
CREATE UNIQUE INDEX "reference_value_target_wiki_key" ON "reference_value" ("target_wiki_id") WHERE "target_wiki_id" is not null;
CREATE UNIQUE INDEX "reference_value_target_indexed_media_key" ON "reference_value" ("target_indexed_media_id") WHERE "target_indexed_media_id" is not null;
CREATE UNIQUE INDEX "reference_value_target_vocabulary_term_key" ON "reference_value" ("target_vocabulary_term_id") WHERE "target_vocabulary_term_id" is not null;
CREATE UNIQUE INDEX "reference_value_target_semantic_relation_key" ON "reference_value" ("target_semantic_relation_id") WHERE "target_semantic_relation_id" is not null;
CREATE INDEX "registry_installation_owner" ON "registry_installation" ("owner_entity_id","id");
CREATE INDEX "schema_label_locale" ON "schema_label" ("term_id","language","id");
CREATE INDEX "schema_label_selection_latest" ON "schema_label_selection" ("term_id","language","version" DESC NULLS LAST);
CREATE INDEX "schema_node_term_idx" ON "schema_node" ("term_id","release_id","id");
CREATE INDEX "schema_relation_subject" ON "schema_relation" ("subject_owner","subject_id","id");
CREATE INDEX "schema_revision_history" ON "schema_relation_revision" ("relation_id","created_at","id");
CREATE INDEX "schema_revision_predicate" ON "schema_relation_revision" ("predicate_id","relation_id","id");
CREATE INDEX "schema_revision_target" ON "schema_relation_revision" (("value"->'reference'->>'owner'),("value"->'reference'->>'id'),"predicate_id","id") WHERE "value"->>'kind' = 'reference';
CREATE INDEX "schema_selection_latest" ON "schema_relation_selection" ("relation_id","version" DESC NULLS LAST);
CREATE INDEX "schema_release_term_reverse" ON "schema_release_term" ("term_id","release_id");
CREATE INDEX "schema_statement_subject_idx" ON "schema_statement" ("release_id","subject_id","predicate_id","id");
CREATE INDEX "schema_statement_reverse_idx" ON "schema_statement" ("release_id","predicate_id","object_id","id");
CREATE INDEX "schema_term_alias_term" ON "schema_term_alias" ("term_id");
CREATE INDEX "subscription_agreement_private" ON "subscription_agreement" ("beneficiary_user_id","id");
CREATE INDEX "subscription_offering_target" ON "subscription_offering" ("target_ref_id","id");
CREATE INDEX "subscription_offering_operator" ON "subscription_offering" ("operator_entity_id","id");
CREATE INDEX "wiki_address_page" ON "wiki_address" ("page_id");
CREATE INDEX "wiki_link_reverse" ON "wiki_link" ("target_page_id","page_id");
CREATE INDEX "wiki_page_subject" ON "wiki_page" ("subject_ref_id","id");
CREATE INDEX "wiki_revision_history" ON "wiki_revision" ("page_id","language","created_at","id");
ALTER TABLE "assertion_assessment" ADD CONSTRAINT "assertion_assessment_issuer_user_id_users_id_fkey" FOREIGN KEY ("issuer_user_id") REFERENCES "users"("id");
ALTER TABLE "assertion_assessment" ADD CONSTRAINT "assertion_assessment_5bW8Sj4oMsAe_fkey" FOREIGN KEY ("object_id","revision_id","statement_id") REFERENCES "description_statement"("object_id","revision_id","id");
ALTER TABLE "catalog_definition_binding" ADD CONSTRAINT "catalog_definition_binding_UR3EpD1L36yp_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision"("id");
ALTER TABLE "catalog_definition_binding" ADD CONSTRAINT "catalog_definition_binding_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");
ALTER TABLE "catalog_definition_binding" ADD CONSTRAINT "catalog_definition_binding_release_id_schema_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "schema_release"("id");
ALTER TABLE "catalog_definition_binding" ADD CONSTRAINT "catalog_definition_binding_piPjheOKiHDi_fkey" FOREIGN KEY ("release_id","term_id") REFERENCES "schema_release_term"("release_id","term_id");
ALTER TABLE "complimentary_award" ADD CONSTRAINT "complimentary_award_beneficiary_user_id_users_id_fkey" FOREIGN KEY ("beneficiary_user_id") REFERENCES "users"("id");
ALTER TABLE "complimentary_award" ADD CONSTRAINT "complimentary_award_issuer_entity_id_entity_identity_id_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity"("id");
ALTER TABLE "contributor_award" ADD CONSTRAINT "contributor_award_beneficiary_user_id_users_id_fkey" FOREIGN KEY ("beneficiary_user_id") REFERENCES "users"("id");
ALTER TABLE "contributor_award" ADD CONSTRAINT "contributor_award_issuer_entity_id_entity_identity_id_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity"("id");
ALTER TABLE "contributor_award" ADD CONSTRAINT "contributor_award_contribution_ref_id_reference_value_id_fkey" FOREIGN KEY ("contribution_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity"("id");
ALTER TABLE "description_change" ADD CONSTRAINT "description_change_object_id_description_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "description_object"("id");
ALTER TABLE "description_change" ADD CONSTRAINT "description_change_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id");
ALTER TABLE "description_evidence" ADD CONSTRAINT "description_evidence_snapshot_blob_id_media_blob_id_fkey" FOREIGN KEY ("snapshot_blob_id") REFERENCES "media_blob"("id");
ALTER TABLE "description_evidence" ADD CONSTRAINT "description_evidence_qxw1WpQfJbYr_fkey" FOREIGN KEY ("object_id","revision_id","statement_id") REFERENCES "description_statement"("object_id","revision_id","id");
ALTER TABLE "description_revision" ADD CONSTRAINT "description_revision_object_id_description_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "description_object"("id");
ALTER TABLE "description_revision" ADD CONSTRAINT "description_revision_aaUpG9AIhchI_fkey" FOREIGN KEY ("object_id","parent_id") REFERENCES "description_revision"("object_id","id");
ALTER TABLE "description_revision" ADD CONSTRAINT "description_revision_U5NFVX0p0Lwp_fkey" FOREIGN KEY ("change_id","object_id") REFERENCES "description_change"("id","object_id");
ALTER TABLE "description_selection" ADD CONSTRAINT "description_selection_object_id_description_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "description_object"("id");
ALTER TABLE "description_selection" ADD CONSTRAINT "description_selection_buRmZZAaauhc_fkey" FOREIGN KEY ("object_id","revision_id") REFERENCES "description_revision"("object_id","id");
ALTER TABLE "description_selection" ADD CONSTRAINT "description_selection_pyP0fmmasuzK_fkey" FOREIGN KEY ("change_id","object_id") REFERENCES "description_change"("id","object_id");
ALTER TABLE "description_statement" ADD CONSTRAINT "description_statement_predicate_id_schema_term_id_fkey" FOREIGN KEY ("predicate_id") REFERENCES "schema_term"("id");
ALTER TABLE "description_statement" ADD CONSTRAINT "description_statement_datatype_id_schema_term_id_fkey" FOREIGN KEY ("datatype_id") REFERENCES "schema_term"("id");
ALTER TABLE "description_statement" ADD CONSTRAINT "description_statement_n514jfOvpmBO_fkey" FOREIGN KEY ("native_target_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "description_statement" ADD CONSTRAINT "description_statement_jjegsCPNwjDO_fkey" FOREIGN KEY ("description_target_id") REFERENCES "description_object"("id");
ALTER TABLE "description_statement" ADD CONSTRAINT "description_statement_Tx3hZZkE7gHv_fkey" FOREIGN KEY ("object_id","revision_id") REFERENCES "description_revision"("object_id","id");
ALTER TABLE "description_type" ADD CONSTRAINT "description_type_type_id_schema_term_id_fkey" FOREIGN KEY ("type_id") REFERENCES "schema_term"("id");
ALTER TABLE "description_type" ADD CONSTRAINT "description_type_CS17Zr4FRiNg_fkey" FOREIGN KEY ("object_id","revision_id") REFERENCES "description_revision"("object_id","id");
ALTER TABLE "entitlement_benefit_head" ADD CONSTRAINT "entitlement_benefit_head_beneficiary_user_id_users_id_fkey" FOREIGN KEY ("beneficiary_user_id") REFERENCES "users"("id");
ALTER TABLE "entitlement_benefit_head" ADD CONSTRAINT "entitlement_benefit_head_2UJHWjalTHVq_fkey" FOREIGN KEY ("benefit_id") REFERENCES "subscription_benefit"("id");
ALTER TABLE "entitlement_benefit_head" ADD CONSTRAINT "entitlement_benefit_head_scope_ref_id_reference_value_id_fkey" FOREIGN KEY ("scope_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_beneficiary_user_id_users_id_fkey" FOREIGN KEY ("beneficiary_user_id") REFERENCES "users"("id");
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_scope_ref_id_reference_value_id_fkey" FOREIGN KEY ("scope_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_I65y1nSgQcaS_fkey" FOREIGN KEY ("benefit_id","benefit_revision_id") REFERENCES "subscription_benefit_revision"("benefit_id","id");
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_74tPGRXkBswM_fkey" FOREIGN KEY ("agreement_id","beneficiary_user_id") REFERENCES "subscription_agreement"("id","beneficiary_user_id");
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_PQW0DHYz2R40_fkey" FOREIGN KEY ("complimentary_award_id","beneficiary_user_id") REFERENCES "complimentary_award"("id","beneficiary_user_id");
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_7YIGjhDAYOxg_fkey" FOREIGN KEY ("contributor_award_id","beneficiary_user_id") REFERENCES "contributor_award"("id","beneficiary_user_id");
ALTER TABLE "entitlement_grant_revision" ADD CONSTRAINT "entitlement_grant_revision_grant_id_entitlement_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "entitlement_grant"("id");
ALTER TABLE "media_blob_location" ADD CONSTRAINT "media_blob_location_blob_id_media_blob_id_fkey" FOREIGN KEY ("blob_id") REFERENCES "media_blob"("id");
ALTER TABLE "media_fetch_state" ADD CONSTRAINT "media_fetch_state_locator_id_media_locator_id_fkey" FOREIGN KEY ("locator_id") REFERENCES "media_locator"("id");
ALTER TABLE "media_fetch_state" ADD CONSTRAINT "media_fetch_state_twzKeLIdgMCl_fkey" FOREIGN KEY ("last_observation_id","locator_id") REFERENCES "media_observation"("id","locator_id");
ALTER TABLE "media_fingerprint" ADD CONSTRAINT "media_fingerprint_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_fingerprint" ADD CONSTRAINT "media_fingerprint_UsD19LGUcSRc_fkey" FOREIGN KEY ("representation_id","media_id") REFERENCES "media_representation"("id","media_id");
ALTER TABLE "media_fragment" ADD CONSTRAINT "media_fragment_representation_id_media_representation_id_fkey" FOREIGN KEY ("representation_id") REFERENCES "media_representation"("id");
ALTER TABLE "media_index_entry" ADD CONSTRAINT "media_index_entry_generation_id_media_index_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "media_index_generation"("id");
ALTER TABLE "media_index_entry" ADD CONSTRAINT "media_index_entry_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_index_entry" ADD CONSTRAINT "media_index_entry_jqhgXSNYr4Gn_fkey" FOREIGN KEY ("media_id","metadata_revision_id") REFERENCES "media_metadata_revision"("media_id","id");
ALTER TABLE "media_locator" ADD CONSTRAINT "media_locator_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_metadata_revision" ADD CONSTRAINT "media_metadata_revision_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_metadata_revision" ADD CONSTRAINT "media_metadata_revision_5nK9j22SRsVy_fkey" FOREIGN KEY ("creator_entity_id") REFERENCES "entity_identity"("id");
ALTER TABLE "media_metadata_revision" ADD CONSTRAINT "media_metadata_revision_APCzyF1ocq0M_fkey" FOREIGN KEY ("media_id","parent_id") REFERENCES "media_metadata_revision"("media_id","id");
ALTER TABLE "media_metadata_selection" ADD CONSTRAINT "media_metadata_selection_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_metadata_selection" ADD CONSTRAINT "media_metadata_selection_ZwVRJ5La8g96_fkey" FOREIGN KEY ("media_id","revision_id") REFERENCES "media_metadata_revision"("media_id","id");
ALTER TABLE "media_observation" ADD CONSTRAINT "media_observation_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_observation" ADD CONSTRAINT "media_observation_artifact_blob_id_media_blob_id_fkey" FOREIGN KEY ("artifact_blob_id") REFERENCES "media_blob"("id");
ALTER TABLE "media_observation" ADD CONSTRAINT "media_observation_ReLHqwW6wdPy_fkey" FOREIGN KEY ("locator_id","media_id") REFERENCES "media_locator"("id","media_id");
ALTER TABLE "media_occurrence" ADD CONSTRAINT "media_occurrence_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_occurrence" ADD CONSTRAINT "media_occurrence_jSzLxDkhUGhn_fkey" FOREIGN KEY ("observation_id","media_id") REFERENCES "media_observation"("id","media_id");
ALTER TABLE "media_representation" ADD CONSTRAINT "media_representation_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_representation" ADD CONSTRAINT "media_representation_blob_id_media_blob_id_fkey" FOREIGN KEY ("blob_id") REFERENCES "media_blob"("id");
ALTER TABLE "media_representation" ADD CONSTRAINT "media_representation_PMrP5FqF46QH_fkey" FOREIGN KEY ("observation_id","media_id") REFERENCES "media_observation"("id","media_id");
ALTER TABLE "media_selection_head" ADD CONSTRAINT "media_selection_head_slot_id_media_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "media_slot"("id");
ALTER TABLE "media_selection_head" ADD CONSTRAINT "media_selection_head_z9Ol7hFnwxu2_fkey" FOREIGN KEY ("slot_id","revision_id") REFERENCES "media_selection_revision"("slot_id","id");
ALTER TABLE "media_selection_member" ADD CONSTRAINT "media_selection_member_eX0Dhi4KsISB_fkey" FOREIGN KEY ("slot_id","selection_revision_id") REFERENCES "media_selection_revision"("slot_id","id");
ALTER TABLE "media_selection_member" ADD CONSTRAINT "media_selection_member_XjWOLEEKZ3vF_fkey" FOREIGN KEY ("slot_id","subject_ref_id","role_id") REFERENCES "media_slot"("id","subject_ref_id","role_id");
ALTER TABLE "media_selection_member" ADD CONSTRAINT "media_selection_member_fCbfQ8xN27Jz_fkey" FOREIGN KEY ("use_id","subject_ref_id","role_id") REFERENCES "media_use"("id","subject_ref_id","role_id");
ALTER TABLE "media_selection_member" ADD CONSTRAINT "media_selection_member_90Ybw8HkgZet_fkey" FOREIGN KEY ("use_id","use_revision_id") REFERENCES "media_use_revision"("use_id","id");
ALTER TABLE "media_selection_revision" ADD CONSTRAINT "media_selection_revision_slot_id_media_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "media_slot"("id");
ALTER TABLE "media_slot" ADD CONSTRAINT "media_slot_subject_ref_id_reference_value_id_fkey" FOREIGN KEY ("subject_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "media_slot" ADD CONSTRAINT "media_slot_role_id_schema_term_id_fkey" FOREIGN KEY ("role_id") REFERENCES "schema_term"("id");
ALTER TABLE "media_stream" ADD CONSTRAINT "media_stream_representation_id_media_representation_id_fkey" FOREIGN KEY ("representation_id") REFERENCES "media_representation"("id");
ALTER TABLE "media_use" ADD CONSTRAINT "media_use_subject_ref_id_reference_value_id_fkey" FOREIGN KEY ("subject_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "media_use" ADD CONSTRAINT "media_use_media_id_media_item_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_item"("id");
ALTER TABLE "media_use" ADD CONSTRAINT "media_use_role_id_schema_term_id_fkey" FOREIGN KEY ("role_id") REFERENCES "schema_term"("id");
ALTER TABLE "media_use_revision" ADD CONSTRAINT "media_use_revision_use_id_media_id_media_use_id_media_id_fkey" FOREIGN KEY ("use_id","media_id") REFERENCES "media_use"("id","media_id");
ALTER TABLE "media_use_revision" ADD CONSTRAINT "media_use_revision_P40LGbDT6uER_fkey" FOREIGN KEY ("representation_id","media_id") REFERENCES "media_representation"("id","media_id");
ALTER TABLE "media_use_revision" ADD CONSTRAINT "media_use_revision_TEwY5zsoPJFX_fkey" FOREIGN KEY ("fragment_id","representation_id") REFERENCES "media_fragment"("id","representation_id");
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_LLeewtfSvw38_fkey" FOREIGN KEY ("representation_id") REFERENCES "media_representation"("id");
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_VGEJrjnEyqFt_fkey" FOREIGN KEY ("message_id","conversation_id") REFERENCES "message"("id","conversation_id") ON DELETE CASCADE;
ALTER TABLE "message_delivery_receipt" ADD CONSTRAINT "message_delivery_receipt_recipient_user_id_users_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id");
ALTER TABLE "message_delivery_receipt" ADD CONSTRAINT "message_delivery_receipt_7joBatsXFOfL_fkey" FOREIGN KEY ("message_id","conversation_id") REFERENCES "message"("id","conversation_id") ON DELETE CASCADE;
ALTER TABLE "message_revision" ADD CONSTRAINT "message_revision_WjAfcjU9ppxj_fkey" FOREIGN KEY ("message_id","conversation_id") REFERENCES "message"("id","conversation_id") ON DELETE CASCADE;
ALTER TABLE "participation_meter" ADD CONSTRAINT "participation_meter_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id");
ALTER TABLE "participation_meter" ADD CONSTRAINT "participation_meter_beneficiary_user_id_users_id_fkey" FOREIGN KEY ("beneficiary_user_id") REFERENCES "users"("id");
ALTER TABLE "participation_meter_entry" ADD CONSTRAINT "participation_meter_entry_meter_id_participation_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "participation_meter"("id");
ALTER TABLE "participation_meter_entry" ADD CONSTRAINT "participation_meter_entry_dm9FfBaHoxlg_fkey" FOREIGN KEY ("meter_id","compensates_id") REFERENCES "participation_meter_entry"("meter_id","id");
ALTER TABLE "participation_review_attempt" ADD CONSTRAINT "participation_review_attempt_x4wpEMCjjlvO_fkey" FOREIGN KEY ("submission_id") REFERENCES "participation_submission"("id");
ALTER TABLE "participation_review_attempt" ADD CONSTRAINT "participation_review_attempt_0zZsdZKNoG3w_fkey" FOREIGN KEY ("submission_id","policy_revision_id","target_revision_id") REFERENCES "participation_submission"("id","policy_revision_id","target_revision_id");
ALTER TABLE "participation_submission" ADD CONSTRAINT "participation_submission_target_ref_id_reference_value_id_fkey" FOREIGN KEY ("target_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "participation_submission" ADD CONSTRAINT "participation_submission_author_user_id_users_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id");
ALTER TABLE "participation_submission" ADD CONSTRAINT "participation_submission_2cA3hFXtlQkM_fkey" FOREIGN KEY ("realm_id","policy_revision_id") REFERENCES "realm_participation_policy_revision"("realm_id","id");
ALTER TABLE "realm_participation_policy" ADD CONSTRAINT "realm_participation_policy_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id");
ALTER TABLE "realm_participation_policy" ADD CONSTRAINT "realm_participation_policy_Mc3HCqqfMDOL_fkey" FOREIGN KEY ("realm_id","current_revision_id") REFERENCES "realm_participation_policy_revision"("realm_id","id");
ALTER TABLE "realm_participation_policy_revision" ADD CONSTRAINT "realm_participation_policy_revision_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id");
ALTER TABLE "reference_value" ADD CONSTRAINT "reference_value_IXpk22oxAh3B_fkey" FOREIGN KEY ("target_description_id") REFERENCES "description_object"("id") ON DELETE RESTRICT;
ALTER TABLE "reference_value" ADD CONSTRAINT "reference_value_target_wiki_id_wiki_page_id_fkey" FOREIGN KEY ("target_wiki_id") REFERENCES "wiki_page"("id") ON DELETE RESTRICT;
ALTER TABLE "reference_value" ADD CONSTRAINT "reference_value_target_indexed_media_id_media_item_id_fkey" FOREIGN KEY ("target_indexed_media_id") REFERENCES "media_item"("id") ON DELETE RESTRICT;
ALTER TABLE "reference_value" ADD CONSTRAINT "reference_value_target_vocabulary_term_id_schema_term_id_fkey" FOREIGN KEY ("target_vocabulary_term_id") REFERENCES "schema_term"("id") ON DELETE RESTRICT;
ALTER TABLE "reference_value" ADD CONSTRAINT "reference_value_Amsu7AFvBokE_fkey" FOREIGN KEY ("target_semantic_relation_id") REFERENCES "schema_relation"("id") ON DELETE RESTRICT;
ALTER TABLE "registry_capability_declaration" ADD CONSTRAINT "registry_capability_declaration_H8hZSTgfSvfN_fkey" FOREIGN KEY ("package_id","release_id") REFERENCES "registry_release"("package_id","id");
ALTER TABLE "registry_dependency" ADD CONSTRAINT "registry_dependency_LPLjdvDsRfX3_fkey" FOREIGN KEY ("dependency_package_id") REFERENCES "registry_package"("id");
ALTER TABLE "registry_dependency" ADD CONSTRAINT "registry_dependency_lcN3r1S3p1hB_fkey" FOREIGN KEY ("package_id","release_id") REFERENCES "registry_release"("package_id","id");
ALTER TABLE "registry_dependency" ADD CONSTRAINT "registry_dependency_kZZ1JfVf1X4c_fkey" FOREIGN KEY ("dependency_package_id","resolved_release_id") REFERENCES "registry_release"("package_id","id");
ALTER TABLE "registry_file" ADD CONSTRAINT "registry_file_blob_id_media_blob_id_fkey" FOREIGN KEY ("blob_id") REFERENCES "media_blob"("id");
ALTER TABLE "registry_file" ADD CONSTRAINT "registry_file_S8dEhUhXaOXu_fkey" FOREIGN KEY ("package_id","release_id") REFERENCES "registry_release"("package_id","id");
ALTER TABLE "registry_installation" ADD CONSTRAINT "registry_installation_owner_entity_id_entity_identity_id_fkey" FOREIGN KEY ("owner_entity_id") REFERENCES "entity_identity"("id");
ALTER TABLE "registry_installation" ADD CONSTRAINT "registry_installation_vrFz0VeuWZGq_fkey" FOREIGN KEY ("package_id","release_id") REFERENCES "registry_release"("package_id","id");
ALTER TABLE "registry_package" ADD CONSTRAINT "registry_package_work_id_software_identity_id_fkey" FOREIGN KEY ("work_id") REFERENCES "software_identity"("id");
ALTER TABLE "registry_release" ADD CONSTRAINT "registry_release_package_id_registry_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "registry_package"("id");
ALTER TABLE "schema_contract_field" ADD CONSTRAINT "schema_contract_field_contract_id_schema_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "schema_contract"("id");
ALTER TABLE "schema_contract_keyword" ADD CONSTRAINT "schema_contract_keyword_VhWqeFhVQ3pz_fkey" FOREIGN KEY ("contract_id","field_id") REFERENCES "schema_contract_field"("contract_id","id");
ALTER TABLE "schema_contract_reference" ADD CONSTRAINT "schema_contract_reference_JGdDdyx5AoVE_fkey" FOREIGN KEY ("target_contract_id") REFERENCES "schema_contract"("id");
ALTER TABLE "schema_contract_reference" ADD CONSTRAINT "schema_contract_reference_M6B1vWT0VW59_fkey" FOREIGN KEY ("contract_id","field_id") REFERENCES "schema_contract_field"("contract_id","id");
ALTER TABLE "schema_definition" ADD CONSTRAINT "schema_definition_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");
ALTER TABLE "schema_definition" ADD CONSTRAINT "schema_definition_vocabulary_id_schema_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "schema_vocabulary"("id");
ALTER TABLE "schema_label" ADD CONSTRAINT "schema_label_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");
ALTER TABLE "schema_label_selection" ADD CONSTRAINT "schema_label_selection_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");
ALTER TABLE "schema_label_selection" ADD CONSTRAINT "schema_label_selection_change_id_schema_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "schema_change"("id");
ALTER TABLE "schema_label_selection" ADD CONSTRAINT "schema_label_selection_cdZCXw5WutiB_fkey" FOREIGN KEY ("label_id","term_id","language") REFERENCES "schema_label"("id","term_id","language");
ALTER TABLE "schema_node" ADD CONSTRAINT "schema_node_release_id_schema_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "schema_release"("id");
ALTER TABLE "schema_node" ADD CONSTRAINT "schema_node_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");
ALTER TABLE "schema_node" ADD CONSTRAINT "schema_node_datatype_id_schema_term_id_fkey" FOREIGN KEY ("datatype_id") REFERENCES "schema_term"("id");
ALTER TABLE "schema_profile_revision" ADD CONSTRAINT "schema_profile_revision_profile_id_schema_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "schema_profile"("id");
ALTER TABLE "schema_profile_rule" ADD CONSTRAINT "schema_profile_rule_52qBaeIzxlEq_fkey" FOREIGN KEY ("profile_revision_id") REFERENCES "schema_profile_revision"("id");
ALTER TABLE "schema_profile_rule" ADD CONSTRAINT "schema_profile_rule_XkHGIddklppP_fkey" FOREIGN KEY ("definition_id","predicate_id") REFERENCES "schema_definition"("id","term_id");
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_relation_id_schema_relation_id_fkey" FOREIGN KEY ("relation_id") REFERENCES "schema_relation"("id");
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_change_id_schema_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "schema_change"("id");
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_droROk66Bxqt_fkey" FOREIGN KEY ("definition_id","predicate_id") REFERENCES "schema_definition"("id","term_id");
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_WmNc1McuNqs6_fkey" FOREIGN KEY ("parent_revision_id","relation_id") REFERENCES "schema_relation_revision"("id","relation_id");
ALTER TABLE "schema_relation_selection" ADD CONSTRAINT "schema_relation_selection_relation_id_schema_relation_id_fkey" FOREIGN KEY ("relation_id") REFERENCES "schema_relation"("id");
ALTER TABLE "schema_relation_selection" ADD CONSTRAINT "schema_relation_selection_change_id_schema_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "schema_change"("id");
ALTER TABLE "schema_relation_selection" ADD CONSTRAINT "schema_relation_selection_ojlKseIgk0io_fkey" FOREIGN KEY ("revision_id","relation_id") REFERENCES "schema_relation_revision"("id","relation_id");
ALTER TABLE "schema_release" ADD CONSTRAINT "schema_release_vocabulary_id_schema_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "schema_vocabulary"("id");
ALTER TABLE "schema_release_context" ADD CONSTRAINT "schema_release_context_release_id_schema_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "schema_release"("id");
ALTER TABLE "schema_release_label" ADD CONSTRAINT "schema_release_label_bFdXyLkau8cL_fkey" FOREIGN KEY ("release_id","term_id") REFERENCES "schema_release_term"("release_id","term_id");
ALTER TABLE "schema_release_label" ADD CONSTRAINT "schema_release_label_glKPZbDWupkm_fkey" FOREIGN KEY ("label_id","term_id") REFERENCES "schema_label"("id","term_id");
ALTER TABLE "schema_release_term" ADD CONSTRAINT "schema_release_term_RHVTUZjJsQ4Y_fkey" FOREIGN KEY ("release_id","vocabulary_id") REFERENCES "schema_release"("id","vocabulary_id");
ALTER TABLE "schema_release_term" ADD CONSTRAINT "schema_release_term_MXWjw5DuAa8W_fkey" FOREIGN KEY ("definition_id","term_id","vocabulary_id") REFERENCES "schema_definition"("id","term_id","vocabulary_id");
ALTER TABLE "schema_statement" ADD CONSTRAINT "schema_statement_release_id_schema_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "schema_release"("id");
ALTER TABLE "schema_statement" ADD CONSTRAINT "schema_statement_predicate_id_schema_term_id_fkey" FOREIGN KEY ("predicate_id") REFERENCES "schema_term"("id");
ALTER TABLE "schema_statement" ADD CONSTRAINT "schema_statement_eKwdXOwLyHlZ_fkey" FOREIGN KEY ("release_id","subject_id") REFERENCES "schema_node"("release_id","id");
ALTER TABLE "schema_statement" ADD CONSTRAINT "schema_statement_sk6IUJ3MLWey_fkey" FOREIGN KEY ("release_id","object_id") REFERENCES "schema_node"("release_id","id");
ALTER TABLE "schema_statement" ADD CONSTRAINT "schema_statement_GffrnDi1R4TD_fkey" FOREIGN KEY ("release_id","graph_id") REFERENCES "schema_node"("release_id","id");
ALTER TABLE "schema_term_alias" ADD CONSTRAINT "schema_term_alias_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");
ALTER TABLE "schema_vocabulary_head" ADD CONSTRAINT "schema_vocabulary_head_vocabulary_id_schema_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "schema_vocabulary"("id");
ALTER TABLE "schema_vocabulary_head" ADD CONSTRAINT "schema_vocabulary_head_cSN2wTj3S6pz_fkey" FOREIGN KEY ("release_id","vocabulary_id") REFERENCES "schema_release"("id","vocabulary_id");
ALTER TABLE "subscription_agreement" ADD CONSTRAINT "subscription_agreement_beneficiary_user_id_users_id_fkey" FOREIGN KEY ("beneficiary_user_id") REFERENCES "users"("id");
ALTER TABLE "subscription_agreement" ADD CONSTRAINT "subscription_agreement_payer_user_id_users_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id");
ALTER TABLE "subscription_agreement" ADD CONSTRAINT "subscription_agreement_plan_id_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id");
ALTER TABLE "subscription_agreement_revision" ADD CONSTRAINT "subscription_agreement_revision_1TKWoDruomou_fkey" FOREIGN KEY ("agreement_id") REFERENCES "subscription_agreement"("id");
ALTER TABLE "subscription_agreement_revision" ADD CONSTRAINT "subscription_agreement_revision_MNyaEr9vIeY8_fkey" FOREIGN KEY ("price_id","plan_id","plan_revision_id") REFERENCES "subscription_price"("id","plan_id","plan_revision_id");
ALTER TABLE "subscription_benefit_binding" ADD CONSTRAINT "subscription_benefit_binding_hTdK2JZWSx9q_fkey" FOREIGN KEY ("scope_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "subscription_benefit_binding" ADD CONSTRAINT "subscription_benefit_binding_HjQKHvhaw0kx_fkey" FOREIGN KEY ("plan_id","plan_revision_id") REFERENCES "subscription_plan_revision"("plan_id","id");
ALTER TABLE "subscription_benefit_binding" ADD CONSTRAINT "subscription_benefit_binding_a0VGoaCy9lXj_fkey" FOREIGN KEY ("benefit_id","benefit_revision_id") REFERENCES "subscription_benefit_revision"("benefit_id","id");
ALTER TABLE "subscription_benefit_revision" ADD CONSTRAINT "subscription_benefit_revision_c52e31jg21iF_fkey" FOREIGN KEY ("benefit_id") REFERENCES "subscription_benefit"("id");
ALTER TABLE "subscription_offering" ADD CONSTRAINT "subscription_offering_target_ref_id_reference_value_id_fkey" FOREIGN KEY ("target_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "subscription_offering" ADD CONSTRAINT "subscription_offering_ZaBqiwcwfVNE_fkey" FOREIGN KEY ("operator_entity_id") REFERENCES "entity_identity"("id");
ALTER TABLE "subscription_operation" ADD CONSTRAINT "subscription_operation_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id");
ALTER TABLE "subscription_operation" ADD CONSTRAINT "subscription_operation_y19anwGL7UqN_fkey" FOREIGN KEY ("agreement_id") REFERENCES "subscription_agreement"("id");
ALTER TABLE "subscription_plan" ADD CONSTRAINT "subscription_plan_esUGt2WMoVCR_fkey" FOREIGN KEY ("group_id","offering_id") REFERENCES "subscription_plan_group"("id","offering_id");
ALTER TABLE "subscription_plan_group" ADD CONSTRAINT "subscription_plan_group_NzvPabYeDazN_fkey" FOREIGN KEY ("offering_id") REFERENCES "subscription_offering"("id");
ALTER TABLE "subscription_plan_revision" ADD CONSTRAINT "subscription_plan_revision_plan_id_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id");
ALTER TABLE "subscription_price" ADD CONSTRAINT "subscription_price_y3eGjZe3dkAJ_fkey" FOREIGN KEY ("plan_id","plan_revision_id") REFERENCES "subscription_plan_revision"("plan_id","id");
ALTER TABLE "subscription_provider_effect" ADD CONSTRAINT "subscription_provider_effect_G0dK9SBpgGyF_fkey" FOREIGN KEY ("event_id") REFERENCES "subscription_provider_event"("id");
ALTER TABLE "subscription_provider_effect" ADD CONSTRAINT "subscription_provider_effect_UzTmX3o3boHl_fkey" FOREIGN KEY ("agreement_id") REFERENCES "subscription_agreement"("id");
ALTER TABLE "subscription_provider_effect" ADD CONSTRAINT "subscription_provider_effect_h1GdK4zkjsSZ_fkey" FOREIGN KEY ("operation_id") REFERENCES "subscription_operation"("id");
ALTER TABLE "wiki_address" ADD CONSTRAINT "wiki_address_page_id_wiki_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_page"("id");
ALTER TABLE "wiki_head" ADD CONSTRAINT "wiki_head_page_id_wiki_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_page"("id");
ALTER TABLE "wiki_head" ADD CONSTRAINT "wiki_head_iiHh6ZGX93gs_fkey" FOREIGN KEY ("page_id","revision_id","language") REFERENCES "wiki_revision"("page_id","id","language");
ALTER TABLE "wiki_link" ADD CONSTRAINT "wiki_link_target_page_id_wiki_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "wiki_page"("id");
ALTER TABLE "wiki_link" ADD CONSTRAINT "wiki_link_page_id_revision_id_wiki_revision_page_id_id_fkey" FOREIGN KEY ("page_id","revision_id") REFERENCES "wiki_revision"("page_id","id");
ALTER TABLE "wiki_page" ADD CONSTRAINT "wiki_page_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id");
ALTER TABLE "wiki_page" ADD CONSTRAINT "wiki_page_subject_ref_id_reference_value_id_fkey" FOREIGN KEY ("subject_ref_id") REFERENCES "reference_value"("id");
ALTER TABLE "wiki_revision" ADD CONSTRAINT "wiki_revision_page_id_wiki_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_page"("id");
ALTER TABLE "wiki_revision" ADD CONSTRAINT "wiki_revision_author_user_id_users_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id");
ALTER TABLE "wiki_revision" ADD CONSTRAINT "wiki_revision_9aF3c23VBELC_fkey" FOREIGN KEY ("page_id","parent_id","language") REFERENCES "wiki_revision"("page_id","id","language");
ALTER TABLE "wiki_revision_payload" ADD CONSTRAINT "wiki_revision_payload_hmh4RXRzXWjG_fkey" FOREIGN KEY ("page_id","revision_id") REFERENCES "wiki_revision"("page_id","id");
ALTER TABLE "wiki_selection" ADD CONSTRAINT "wiki_selection_page_id_wiki_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_page"("id");
ALTER TABLE "wiki_selection" ADD CONSTRAINT "wiki_selection_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id");
ALTER TABLE "wiki_selection" ADD CONSTRAINT "wiki_selection_MuAbG64GbTwI_fkey" FOREIGN KEY ("page_id","revision_id","language") REFERENCES "wiki_revision"("page_id","id","language");
ALTER TABLE "conversation_read" DROP CONSTRAINT "conversation_read_last_read_message_id_message_id_fkey", ADD CONSTRAINT "conversation_read_last_read_message_id_message_id_fkey" FOREIGN KEY ("last_read_message_id","conversation_id") REFERENCES "message"("id","conversation_id");
ALTER TABLE "message" ADD CONSTRAINT "message_revision_positive" CHECK ("revision">0 and "revision"<=9007199254740991);
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_participant_order_check", ADD CONSTRAINT "conversation_participant_order_check" CHECK (("kind"='direct' and num_nonnulls("participant_low_entity_id","participant_high_entity_id","participant_low_auth_user_id","participant_high_auth_user_id")=4 and "participant_low_auth_user_id" < "participant_high_auth_user_id") or ("kind"='group' and num_nonnulls("participant_low_entity_id","participant_high_entity_id","participant_low_auth_user_id","participant_high_auth_user_id")=0));
ALTER TABLE "reference_value" DROP CONSTRAINT "reference_value_target_check", ADD CONSTRAINT "reference_value_target_check" CHECK (num_nonnulls("target_publishing_id", "target_music_id", "target_program_id", "target_software_id", "target_entity_id", "target_grouping_id", "target_reference_id", "target_distribution_id", "target_video_id", "target_audio_id", "target_post_id", "target_poll_id", "target_zone_id", "target_realm_id", "target_realm_rule_id", "target_custom_theme_id", "target_collection_id", "target_tag_id", "target_tag_path_id", "target_label_id", "target_description_id", "target_wiki_id", "target_indexed_media_id", "target_vocabulary_term_id", "target_semantic_relation_id") = 1);

-- Canonical vocabulary integrity guards. Install through the main schema_complete migration bundle.
CREATE OR REPLACE FUNCTION public.schema_reject_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Schema identities, revisions and decisions are immutable; append a new revision or selection'
    USING ERRCODE = '23514';
END;
$$;

DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'schema_vocabulary','schema_release','schema_release_context','schema_term','schema_term_alias',
    'schema_definition','schema_release_term','schema_label','schema_release_label','schema_change',
    'schema_label_selection','schema_profile','schema_profile_revision','schema_profile_rule',
    'schema_relation','schema_relation_revision','schema_relation_selection',
    'schema_node','schema_statement','schema_contract','schema_contract_field','schema_contract_keyword','schema_contract_reference','catalog_definition_binding'
  ] LOOP
    EXECUTE format('CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation()', name);
  END LOOP;
END;
$$;

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


CREATE OR REPLACE FUNCTION public.media_selection_member_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE slot uuid; rev uuid; frozen boolean;
BEGIN
 IF TG_OP='DELETE' THEN slot:=OLD.slot_id; rev:=OLD.selection_revision_id; ELSE slot:=NEW.slot_id; rev:=NEW.selection_revision_id; END IF;
 SELECT sealed INTO frozen FROM public.media_selection_revision WHERE slot_id=slot AND id=rev FOR SHARE;
 IF frozen THEN RAISE EXCEPTION 'A sealed media selection is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.slot_id<>OLD.slot_id OR NEW.selection_revision_id<>OLD.selection_revision_id) THEN
   RAISE EXCEPTION 'Selection membership cannot change owner' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE OR REPLACE TRIGGER media_selection_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public.media_selection_member
FOR EACH ROW EXECUTE FUNCTION public.media_selection_member_guard();

CREATE OR REPLACE FUNCTION public.media_selection_seal_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE minimum integer; maximum integer; members bigint;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.slot_id<>OLD.slot_id OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'Selection identity cannot change' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND OLD.sealed THEN RAISE EXCEPTION 'A sealed selection cannot be changed' USING ERRCODE='23514'; END IF;
 IF NEW.sealed THEN
  SELECT s.minimum,s.maximum INTO minimum,maximum FROM public.media_slot s WHERE s.id=NEW.slot_id FOR SHARE;
  SELECT count(*) INTO members FROM public.media_selection_member WHERE slot_id=NEW.slot_id AND selection_revision_id=NEW.id;
  IF members<minimum OR members>maximum THEN RAISE EXCEPTION 'Media slot cardinality violated' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER media_selection_seal_guard BEFORE INSERT OR UPDATE ON public.media_selection_revision
FOR EACH ROW EXECUTE FUNCTION public.media_selection_seal_guard();

CREATE OR REPLACE FUNCTION public.media_selection_head_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.media_selection_revision WHERE slot_id=NEW.slot_id AND id=NEW.revision_id AND sealed FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selection head requires a sealed exact revision' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND NEW.version<>OLD.version+1) THEN
  RAISE EXCEPTION 'Selection version must advance exactly once' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER media_selection_head_guard BEFORE INSERT OR UPDATE ON public.media_selection_head
FOR EACH ROW EXECUTE FUNCTION public.media_selection_head_guard();

-- Scope and bounds are immutable. A changed role/language/cardinality creates a new slot.
CREATE OR REPLACE TRIGGER media_slot_immutable BEFORE UPDATE ON public.media_slot
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER media_use_immutable BEFORE UPDATE ON public.media_use
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER media_use_revision_immutable BEFORE UPDATE ON public.media_use_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();


-- Current bodies stay in message. Only edits create closed versions; erasure also removes historical payloads.
CREATE OR REPLACE FUNCTION public.capture_message_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.content IS NOT DISTINCT FROM OLD.content AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
   IF NEW.revision<>OLD.revision THEN RAISE EXCEPTION 'Message revision changes require a content transition' USING ERRCODE='23514'; END IF;
   RETURN NEW;
 END IF;
 IF OLD.deleted_at IS NOT NULL AND NEW.content IS NOT NULL THEN
   RAISE EXCEPTION 'Erased message content cannot be restored' USING ERRCODE='23514';
 END IF;
 IF OLD.content IS NOT NULL THEN
   INSERT INTO public.message_revision(conversation_id,message_id,revision,content,valid_from,closed_at,erased_at)
   VALUES(OLD.conversation_id,OLD.id,OLD.revision,
     CASE WHEN NEW.deleted_at IS NULL THEN OLD.content ELSE NULL END,
     OLD.updated_at,clock_timestamp(),CASE WHEN NEW.deleted_at IS NULL THEN NULL ELSE clock_timestamp() END);
 END IF;
 NEW.revision:=OLD.revision+1;
 IF NEW.deleted_at IS NOT NULL THEN
   UPDATE public.message_revision SET content=NULL,erased_at=coalesce(erased_at,clock_timestamp())
   WHERE conversation_id=OLD.conversation_id AND message_id=OLD.id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER message_capture_revision BEFORE UPDATE ON public.message
FOR EACH ROW EXECUTE FUNCTION public.capture_message_revision();

CREATE OR REPLACE FUNCTION public.guard_message_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.content IS NULL AND NEW.erased_at IS NOT NULL
    AND (to_jsonb(NEW)-ARRAY['content','erased_at'])=(to_jsonb(OLD)-ARRAY['content','erased_at']) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Closed message revisions only permit payload erasure' USING ERRCODE='23514';
END $$;
CREATE OR REPLACE TRIGGER message_revision_immutable BEFORE UPDATE ON public.message_revision
FOR EACH ROW EXECUTE FUNCTION public.guard_message_revision();


DROP TRIGGER IF EXISTS reference_value_immutable ON public.reference_value;
CREATE TRIGGER reference_value_immutable
BEFORE UPDATE OR DELETE ON public.reference_value
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

-- Internal projection only: resolving a reference grants no access to its target.
-- VOLATILE observes references admitted by the calling statement, including data-modifying CTEs.
CREATE OR REPLACE FUNCTION public.reference_value_native_id(value_id uuid)
RETURNS uuid LANGUAGE sql VOLATILE STRICT SET search_path = pg_catalog, public AS $$
  SELECT coalesce(target_publishing_id, target_music_id, target_program_id,
    target_software_id, target_entity_id, target_grouping_id, target_reference_id,
    target_distribution_id, target_video_id, target_audio_id, target_post_id,
    target_poll_id, target_zone_id, target_realm_id, target_realm_rule_id,
    target_custom_theme_id, target_collection_id, target_tag_id, target_tag_path_id,
    target_label_id, target_description_id, target_wiki_id, target_indexed_media_id,
    target_vocabulary_term_id, target_semantic_relation_id)
  FROM public.reference_value WHERE id = value_id
$$;
