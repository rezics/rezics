-- These newly created native change families use the source aggregate route.
DO $$
DECLARE parent_name text; owner_name text; kind text; partition_number integer; parents text[] := ARRAY['software_source_context_application_change','software_source_participation_application_change','music_component_source_baseline'];
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    FOREACH kind IN ARRAY ARRAY['semantic','name','authority'] LOOP
      parents := array_append(parents, owner_name || '_source_' || kind || '_application_change');
    END LOOP;
  END LOOP;
  FOREACH parent_name IN ARRAY parents LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
    END LOOP;
  END LOOP;
END $$;
