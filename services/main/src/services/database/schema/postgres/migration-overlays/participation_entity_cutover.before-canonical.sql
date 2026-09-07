-- Atlas Community omits physical children from inspection; create them before canonical per-leaf guards.
DO $$ DECLARE owner_name text; family text; parent_name text; partition_number integer;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    FOREACH family IN ARRAY ARRAY['profile_source_occurrence','source_profile_application_change','source_profile_baseline'] LOOP
      parent_name := owner_name || '_' || family;
      FOR partition_number IN 0..63 LOOP
        EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text,2,'0'),parent_name,partition_number);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
