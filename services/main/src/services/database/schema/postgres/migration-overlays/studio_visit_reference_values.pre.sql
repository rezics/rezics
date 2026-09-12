-- Remove input triggers before their referenced native-ID column is dropped.
DROP TRIGGER IF EXISTS unit_reference_resource_unit ON public.studio_resource_visit;
DROP TRIGGER IF EXISTS reject_merged_unit_studio_resource_visit_resource_unit_id ON public.studio_resource_visit;
