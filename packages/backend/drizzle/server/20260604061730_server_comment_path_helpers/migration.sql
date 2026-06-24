CREATE OR REPLACE FUNCTION rezics_to_base36(n bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits CONSTANT text := '0123456789abcdefghijklmnopqrstuvwxyz';
  out text := '';
  v bigint := n;
BEGIN
  IF v IS NULL THEN
    RETURN NULL;
  END IF;
  IF v < 0 THEN
    RAISE EXCEPTION 'rezics_to_base36: negative input %', v;
  END IF;
  IF v = 0 THEN
    RETURN '0';
  END IF;
  WHILE v > 0 LOOP
    out := substr(digits, (v % 36)::int + 1, 1) || out;
    v := v / 36;
  END LOOP;
  RETURN out;
END;
$$;
