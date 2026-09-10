DROP TRIGGER IF EXISTS revision_reference_immutable ON public.revision_reference;
CREATE TRIGGER revision_reference_immutable
BEFORE UPDATE OR DELETE ON public.revision_reference
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
