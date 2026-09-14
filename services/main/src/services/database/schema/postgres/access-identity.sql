DROP TRIGGER IF EXISTS access_subject_immutable ON public.access_subject;
CREATE TRIGGER access_subject_immutable
BEFORE UPDATE OR DELETE ON public.access_subject
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

DROP TRIGGER IF EXISTS access_scope_immutable ON public.access_scope;
CREATE TRIGGER access_scope_immutable
BEFORE UPDATE OR DELETE ON public.access_scope
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
