-- Breaking fresh-target replacement of the pre-partition source contract.
-- Existing source UUIDs are not a conversion input: new source IDs are deterministic.
-- This discards exactly these source parents and their rows. CASCADE removes inbound
-- foreign keys (not their owning native/support tables); the typed diff recreates them.
-- Nonempty native support may refer to discarded source evidence and is not promised
-- convertible by this migration. Legacy/offline data migration is a separate input.
DROP TABLE
  public.catalog_source_adoption_proposal,
  public.publishing_source_binding,
  public.music_source_binding,
  public.program_source_binding,
  public.software_source_binding,
  public.entity_source_binding,
  public.grouping_source_binding,
  public.reference_source_binding,
  public.catalog_source_mapping_claim,
  public.catalog_source_snapshot,
  public.catalog_source_record
CASCADE;
