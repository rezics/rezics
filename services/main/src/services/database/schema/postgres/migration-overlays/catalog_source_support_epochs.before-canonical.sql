DO $$ DECLARE owner_name text; partition_number integer; relation_name text;
BEGIN
  FOR partition_number IN 0..63 LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.catalog_source_proposal_dependency FOR VALUES WITH (MODULUS 64, REMAINDER %s)', 'catalog_source_proposal_dependency_p' || lpad(partition_number::text,2,'0'),partition_number);
  END LOOP;
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    relation_name := owner_name || '_source_identifier_application_change';
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', relation_name || '_p' || lpad(partition_number::text,2,'0'),relation_name,partition_number);
    END LOOP;
  END LOOP;
END $$;
