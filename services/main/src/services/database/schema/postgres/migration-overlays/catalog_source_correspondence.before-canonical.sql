DO $$ DECLARE partition_number integer;
BEGIN
  FOR partition_number IN 0..63 LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.catalog_definition_term_support FOR VALUES WITH (MODULUS 64, REMAINDER %s)', 'catalog_definition_term_support_p' || lpad(partition_number::text,2,'0'),partition_number);
  END LOOP;
END $$;
