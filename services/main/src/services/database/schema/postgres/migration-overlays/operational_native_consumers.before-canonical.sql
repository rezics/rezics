DO $$
DECLARE owner_name text; kind text; parent_name text; partition_number integer;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['program','publishing'] LOOP
    FOREACH kind IN ARRAY ARRAY['occurrence','application_change','baseline'] LOOP
      parent_name:=owner_name || '_structure_source_' || kind;
      FOR partition_number IN 0..63 LOOP
        EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
