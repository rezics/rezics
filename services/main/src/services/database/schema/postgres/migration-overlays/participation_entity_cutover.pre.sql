-- This is the reviewed fresh-target Auth/Entity replacement, not an in-place legacy account conversion.
DO 'BEGIN
  IF EXISTS(SELECT 1 FROM public.profile) OR EXISTS(SELECT 1 FROM public.unit_access_grant)
    OR EXISTS(SELECT 1 FROM public.unit_access_restriction) THEN
    RAISE EXCEPTION ''Auth/Entity replacement requires an empty legacy participation target; use the separate offline conversion'';
  END IF;
END';
-- Atlas cannot remove enum labels; these subject alternatives acquire their new Auth meaning only on an empty target.
ALTER TYPE public.unit_access_subject_kind RENAME VALUE 'profile' TO 'auth';
ALTER TYPE public.unit_access_restriction_subject_kind RENAME VALUE 'profile' TO 'auth';
-- These old column-specific triggers are replaced by the new owning contracts after the typed DDL.
DROP TRIGGER IF EXISTS book_chapter_progress_stat_maintain ON public.content_structure_node_progress;
DROP TRIGGER IF EXISTS notification_recipient_stat_maintain ON public.notification;
DROP TRIGGER IF EXISTS reject_merged_unit_credit_attribution_credited_unit_id ON public.credit_attribution;
DROP TRIGGER IF EXISTS studio_editor_candidate_from_grant ON public.unit_access_grant;
DROP TRIGGER IF EXISTS unit_progress_stats_maintain ON public.unit_progress;
