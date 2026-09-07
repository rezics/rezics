-- The stopped-site replacement uses Auth-owned private tag data; this is a renamed phase, not an alias.
ALTER TYPE public.unit_merge_operation_phase RENAME VALUE 'profile_unit_tags' TO 'account_unit_tags';

-- Remove the old dependent keys before Atlas replaces their referenced keys.
-- The generated diff recreates each foreign key with its exact correspondence.
ALTER TABLE public.publishing_name_source_occurrence DROP CONSTRAINT publishing_name_source_occurrence_binding_fk;
ALTER TABLE public.music_name_source_occurrence DROP CONSTRAINT music_name_source_occurrence_binding_fk;
ALTER TABLE public.software_name_source_occurrence DROP CONSTRAINT software_name_source_occurrence_binding_fk;
ALTER TABLE public.program_name_source_occurrence DROP CONSTRAINT program_name_source_occurrence_binding_fk;
ALTER TABLE public.entity_name_source_occurrence DROP CONSTRAINT entity_name_source_occurrence_binding_fk;
ALTER TABLE public.reference_name_source_occurrence DROP CONSTRAINT reference_name_source_occurrence_binding_fk;
ALTER TABLE public.grouping_name_source_occurrence DROP CONSTRAINT grouping_name_source_occurrence_binding_fk;
ALTER TABLE public.distribution_name_source_occurrence DROP CONSTRAINT distribution_name_source_occurrence_binding_fk;
