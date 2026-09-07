DO $$
DECLARE parent_name text; owner_name text; partition_number integer; parents text[] := ARRAY['software_source_record_baseline','software_source_component_baseline','software_source_context_baseline','software_source_participation_baseline','software_record_source_occurrence','software_component_source_occurrence'];
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    parents := array_append(parents, owner_name || '_source_owned_baseline');
  END LOOP;
  FOREACH parent_name IN ARRAY parents LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
    END LOOP;
  END LOOP;
END $$;
