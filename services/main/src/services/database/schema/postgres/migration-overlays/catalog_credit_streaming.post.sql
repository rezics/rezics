-- The credit tables are introduced earlier in this same unpublished migration
-- series; no released writer can populate them. Do not reinterpret preview data
-- as an empty prefix or reset unrelated development data if that assumption fails.
-- This postcondition aborts the complete migration transaction on a nonempty preview.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.music_artist_credit LIMIT 1) THEN
    RAISE EXCEPTION 'Native credit preview data requires a reviewed bounded conversion before this unpublished credit-contract migration';
  END IF;
END;
$$;
