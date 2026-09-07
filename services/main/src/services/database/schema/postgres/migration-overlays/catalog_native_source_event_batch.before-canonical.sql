-- Atlas Community omits physical children from its parent-table schema diff.
-- Create source leaves before canonical deferred constraint triggers are installed.
DO $$
DECLARE owner_table text; partition_number integer;
BEGIN
  FOREACH owner_table IN ARRAY ARRAY[
    'catalog_source_record', 'catalog_source_snapshot', 'catalog_source_mapping_claim',
    'catalog_source_binding_revision', 'catalog_source_check_receipt', 'catalog_source_adoption_proposal',
    'catalog_source_subscription', 'catalog_source_observation_fanout', 'catalog_source_check_plan',
    'publishing_source_binding', 'music_source_binding', 'program_source_binding',
    'software_source_binding', 'entity_source_binding', 'grouping_source_binding', 'reference_source_binding',
    'distribution_source_binding'
  ] LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)',
        owner_table || '_p' || lpad(partition_number::text, 2, '0'), owner_table, partition_number);
    END LOOP;
  END LOOP;
  FOR partition_number IN 0..63 LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.operational_relay_pending FOR VALUES FROM (%s) TO (%s)',
      'operational_relay_pending_p' || lpad(partition_number::text, 2, '0'),
      partition_number * 16, (partition_number + 1) * 16);
  END LOOP;
END;
$$;
