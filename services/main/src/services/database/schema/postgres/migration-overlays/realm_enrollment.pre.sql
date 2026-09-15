DROP TRIGGER IF EXISTS realm_member_stat_maintain ON public.realm_member;
DROP FUNCTION IF EXISTS public.maintain_realm_member_stat();
-- The replaced writable roster is discarded; retain other Realm metrics.
UPDATE public.realm_stat SET active_member_count=0 WHERE active_member_count<>0;
