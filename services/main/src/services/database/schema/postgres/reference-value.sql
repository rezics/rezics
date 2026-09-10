DROP TRIGGER IF EXISTS reference_value_immutable ON public.reference_value;
CREATE TRIGGER reference_value_immutable
BEFORE UPDATE OR DELETE ON public.reference_value
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
