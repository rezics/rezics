-- Atlas Community omits children; source application leaves must exist before deferred guards.
DO $$
DECLARE parent_name text; partition_number integer;
BEGIN
  FOREACH parent_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change'] LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
    END LOOP;
  END LOOP;
END $$;
