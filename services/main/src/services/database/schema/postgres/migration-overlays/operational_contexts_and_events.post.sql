-- Atlas Community inspects partitioned parents but omits their physical children.
-- All parent keys/constraints come from the typed exporter; this overlay owns only placement.
DO $$
DECLARE owner_table text; partition_number integer;
BEGIN
  FOREACH owner_table IN ARRAY ARRAY['operational_outbox', 'operational_task_intent', 'operational_application_receipt'] LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES FROM (%s) TO (%s)',
        owner_table || '_p' || lpad(partition_number::text, 2, '0'), owner_table,
        partition_number * 16, (partition_number + 1) * 16);
    END LOOP;
  END LOOP;
END;
$$;
