-- Remove input triggers before their referenced column is dropped.
DROP TRIGGER IF EXISTS unit_reference_unit ON public.unit_follow;
DROP TRIGGER IF EXISTS reject_merged_unit_unit_follow_unit_id ON public.unit_follow;
-- Atlas's structural diff drops the parent key before modifying this child.
ALTER TABLE public.account_follow_preference DROP CONSTRAINT IF EXISTS account_follow_preference_follow_fk;
