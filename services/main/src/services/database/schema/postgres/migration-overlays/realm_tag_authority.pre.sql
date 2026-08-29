-- Remove the accidental overload emitted by the initial semantic-model cutover.
-- Runtime callers and the canonical contract use the original three-key batch.
DROP FUNCTION IF EXISTS public.lock_realm_tag_judgment_keys(uuid[], uuid[], uuid[], uuid[]);
