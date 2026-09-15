-- Remove obsolete account/Self-only owner functions before the generated table replacement.
DROP FUNCTION IF EXISTS public.organization_membership_guard_invitation() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_guard_member() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_guard_event() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_record_event() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_assert_invitation_authority(uuid,bigint,uuid,bigint,uuid,bigint) CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_lock_admission(uuid,uuid) CASCADE;
