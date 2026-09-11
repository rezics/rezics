-- Remove obsolete input triggers before their referenced column is dropped.
DROP TRIGGER IF EXISTS unit_reference_unit ON public.recommendation_exclusion;
DROP TRIGGER IF EXISTS reject_merged_unit_recommendation_exclusion_unit_id ON public.recommendation_exclusion;
