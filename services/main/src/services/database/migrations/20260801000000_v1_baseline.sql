--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: approx_count; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA approx_count;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: amcheck; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS amcheck WITH SCHEMA public;


--
-- Name: approx_count; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS approx_count WITH SCHEMA approx_count;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: pgroonga; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA public;


--
-- Name: pgstattuple; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgstattuple WITH SCHEMA public;


--
-- Name: ai_disclosure; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_disclosure AS ENUM (
    'unknown',
    'none',
    'ai_assisted',
    'ai_originated',
    'machine_generated'
);


--
-- Name: alias_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alias_kind AS ENUM (
    'common',
    'abbreviation',
    'transliteration',
    'alternate_title',
    'legacy_title',
    'misspelling',
    'other'
);


--
-- Name: association_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.association_kind AS ENUM (
    'credit',
    'subject'
);


--
-- Name: association_proposal_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.association_proposal_direction AS ENUM (
    'request',
    'invitation'
);


--
-- Name: association_proposal_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.association_proposal_resolution AS ENUM (
    'accepted',
    'declined',
    'cancelled'
);


--
-- Name: audit_actor_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_actor_kind AS ENUM (
    'profile',
    'system'
);


--
-- Name: audit_authority_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_authority_kind AS ENUM (
    'platform',
    'realm',
    'unit'
);


--
-- Name: audit_credential_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_credential_kind AS ENUM (
    'session',
    'api_token',
    'bootstrap',
    'system'
);


--
-- Name: audit_event_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_event_category AS ENUM (
    'admin_activity',
    'policy_denied',
    'system_event'
);


--
-- Name: audit_event_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_event_outcome AS ENUM (
    'succeeded',
    'denied',
    'failed'
);


--
-- Name: content_rating; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.content_rating AS ENUM (
    'general',
    'r15',
    'r18',
    'r18g'
);


--
-- Name: content_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.content_status AS ENUM (
    'draft',
    'published',
    'archived'
);


--
-- Name: email_outbox_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_outbox_kind AS ENUM (
    'verify_email',
    'reset_password',
    'notification'
);


--
-- Name: email_outbox_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_outbox_status AS ENUM (
    'pending',
    'processing',
    'accepted',
    'failed'
);


--
-- Name: email_provider_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_provider_status AS ENUM (
    'logged',
    'queued',
    'delivered'
);


--
-- Name: enforcement_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enforcement_kind AS ENUM (
    'warning',
    'silence',
    'suspension',
    'ban',
    'rate_limit',
    'trust_restriction'
);


--
-- Name: governance_note_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.governance_note_role AS ENUM (
    'evidence',
    'internal_note',
    'public_notice'
);


--
-- Name: governance_note_subject_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.governance_note_subject_kind AS ENUM (
    'moderation_case',
    'moderation_action',
    'unit_access_restriction',
    'realm_unit_status_event'
);


--
-- Name: governance_reason_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.governance_reason_code AS ENUM (
    'content_policy',
    'copyright',
    'realm_rules',
    'spam',
    'harassment',
    'unsafe_content',
    'off_topic',
    'duplicate',
    'account_security',
    'user_request',
    'appeal',
    'administrative',
    'other'
);


--
-- Name: image_asset_access; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.image_asset_access AS ENUM (
    'private',
    'public'
);


--
-- Name: image_asset_presentation_fit; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.image_asset_presentation_fit AS ENUM (
    'crop',
    'contain'
);


--
-- Name: image_asset_presentation_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.image_asset_presentation_role AS ENUM (
    'avatar',
    'banner',
    'cover'
);


--
-- Name: image_asset_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.image_asset_status AS ENUM (
    'pending',
    'ready',
    'failed'
);


--
-- Name: moderation_action_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.moderation_action_kind AS ENUM (
    'approve',
    'hide',
    'remove',
    'restore',
    'lock_post_targeting',
    'unlock_post_targeting',
    'invalidate_content_license',
    'restore_content_license',
    'warning',
    'silence',
    'suspension',
    'ban',
    'rate_limit',
    'trust_restriction',
    'revoke_enforcement',
    'mute_member',
    'remove_member',
    'ban_member',
    'restore_member',
    'escalate',
    'reverse',
    'note',
    'dismiss'
);


--
-- Name: moderation_authority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.moderation_authority AS ENUM (
    'platform',
    'realm'
);


--
-- Name: moderation_case_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.moderation_case_state AS ENUM (
    'new',
    'triaged',
    'assigned',
    'actioned',
    'resolved',
    'duplicate',
    'rejected',
    'escalated',
    'reviewing'
);


--
-- Name: moderation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.moderation_status AS ENUM (
    'approved',
    'pending',
    'removed'
);


--
-- Name: moderation_target_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.moderation_target_kind AS ENUM (
    'unit',
    'unit_field',
    'profile',
    'realm_unit',
    'realm_member'
);


--
-- Name: notification_email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_email_status AS ENUM (
    'not_requested',
    'pending',
    'sent',
    'failed'
);


--
-- Name: notification_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_kind AS ENUM (
    'reply',
    'new_follower',
    'direct_message',
    'moderation',
    'realm',
    'system'
);


--
-- Name: platform_capability; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_capability AS ENUM (
    'platform.access.read',
    'platform.access.manage',
    'platform.audit.read',
    'platform.user.read',
    'platform.user.status.update',
    'platform.session.read',
    'platform.session.revoke',
    'entity.associations.override',
    'unit.edit',
    'platform.development_preview.access',
    'unit.ownership.transfer',
    'unit.delete',
    'unit.restore',
    'unit.governance.read',
    'unit.ownership.override',
    'unit.content_license.manage',
    'unit.slug.manage',
    'unit.slug.namespace.manage',
    'unit.slug.redirect.release',
    'platform.api_quota_policy.read',
    'platform.api_quota_policy.update',
    'platform.user.api_quota.read',
    'platform.user.api_quota.update',
    'platform.user.api_token.api_quota.read',
    'platform.user.api_token.api_quota.update',
    'platform.moderate',
    'platform.suppress',
    'realm.contribute',
    'realm.units.create',
    'realm.post.replies.create',
    'realm.settings.update',
    'realm.members.read',
    'realm.members.manage',
    'realm.rules.update',
    'realm.pins.manage',
    'realm.tags.manage',
    'realm.tag-voting.update',
    'realm.tag-contexts.manage',
    'realm.units.moderate'
);


--
-- Name: poll_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poll_mode AS ENUM (
    'single',
    'multiple'
);


--
-- Name: poll_option_source_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poll_option_source_kind AS ENUM (
    'literal',
    'unit'
);


--
-- Name: poll_result_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.poll_result_visibility AS ENUM (
    'live',
    'after_close'
);


--
-- Name: post_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.post_kind AS ENUM (
    'post',
    'reply',
    'excerpt',
    'review',
    'chapter',
    'page',
    'wiki',
    'picture',
    'governance_note'
);


--
-- Name: progress_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.progress_status AS ENUM (
    'backlog',
    'active',
    'paused',
    'completed',
    'dropped'
);


--
-- Name: reaction_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reaction_kind AS ENUM (
    'upvote',
    'downvote'
);


--
-- Name: realm_access_subject_relation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_access_subject_relation AS ENUM (
    'member',
    'access_manager'
);


--
-- Name: realm_join_policy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_join_policy AS ENUM (
    'open',
    'approval'
);


--
-- Name: realm_member_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_member_state AS ENUM (
    'active',
    'pending',
    'muted',
    'removed',
    'banned'
);


--
-- Name: realm_page_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_page_kind AS ENUM (
    'main',
    'tags',
    'wiki'
);


--
-- Name: realm_pin_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_pin_kind AS ENUM (
    'pinned',
    'highlight'
);


--
-- Name: realm_rule_acknowledgement_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_rule_acknowledgement_mode AS ENUM (
    'explicit',
    'implicit_on_follow'
);


--
-- Name: realm_unit_publication_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_unit_publication_state AS ENUM (
    'active',
    'withdrawn'
);


--
-- Name: realm_unit_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.realm_unit_status AS ENUM (
    'pending',
    'visible',
    'hidden',
    'removed'
);


--
-- Name: recommendation_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recommendation_event_type AS ENUM (
    'impression',
    'open',
    'dwell_30s',
    'not_interested'
);


--
-- Name: recommendation_signal_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recommendation_signal_kind AS ENUM (
    'impression',
    'open',
    'dwell_30s',
    'not_interested',
    'upvote',
    'downvote',
    'reply',
    'favorite',
    'share',
    'score_high',
    'score_medium',
    'score_low',
    'progress_active',
    'progress_completed',
    'progress_dropped'
);


--
-- Name: recommendation_snapshot_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recommendation_snapshot_state AS ENUM (
    'building',
    'ready',
    'failed'
);


--
-- Name: recommendation_surface; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recommendation_surface AS ENUM (
    'home_feed',
    'home_book',
    'home_software',
    'home_media',
    'unit_related',
    'post_related'
);


--
-- Name: resource_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resource_visibility AS ENUM (
    'public',
    'unlisted',
    'private'
);


--
-- Name: unit_access_invitation_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_access_invitation_resolution AS ENUM (
    'accepted',
    'declined',
    'cancelled'
);


--
-- Name: unit_access_restriction_subject_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_access_restriction_subject_kind AS ENUM (
    'profile',
    'realm'
);


--
-- Name: unit_access_subject_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_access_subject_kind AS ENUM (
    'profile',
    'realm',
    'authenticated'
);


--
-- Name: unit_content_license_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_content_license_status AS ENUM (
    'active',
    'invalidated'
);


--
-- Name: unit_ownership_claim_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_ownership_claim_resolution AS ENUM (
    'approved',
    'rejected',
    'withdrawn',
    'superseded'
);


--
-- Name: unit_permission; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_permission AS ENUM (
    'unit.read',
    'unit.update',
    'unit.status.update',
    'unit.history.restore',
    'unit.access.manage',
    'unit.ownership.transfer',
    'unit.association.manage',
    'unit.tag-curation.manage',
    'unit.reference-curation.manage',
    'unit.realm-publication.manage',
    'unit.delete',
    'realm.contribute',
    'realm.units.create',
    'realm.post.replies.create',
    'realm.settings.update',
    'realm.members.read',
    'realm.members.manage',
    'realm.rules.update',
    'realm.pins.manage',
    'realm.tags.manage',
    'realm.tag-voting.update',
    'realm.tag-contexts.manage',
    'realm.units.moderate',
    'entity.association.credit.request',
    'entity.association.credit.direct',
    'entity.association.subject.request',
    'entity.association.subject.direct'
);


--
-- Name: unit_revision_slot_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_revision_slot_role AS ENUM (
    'main',
    'localization',
    'relations',
    'structure',
    'rules'
);


--
-- Name: unit_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_status AS ENUM (
    'draft',
    'published',
    'archived'
);


--
-- Name: unit_status_actor_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_status_actor_kind AS ENUM (
    'profile',
    'system',
    'import'
);


--
-- Name: user_account_state_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_account_state_reason AS ENUM (
    'security',
    'policy_violation',
    'compromised',
    'user_request',
    'legal',
    'other'
);


--
-- Name: user_account_state_value; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_account_state_value AS ENUM (
    'active',
    'suspended',
    'closed'
);


--
-- Name: apply_book_chapter_delta(uuid, uuid, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_book_chapter_delta(p_book_unit_id uuid, p_node_id uuid, p_all_delta bigint, p_public_delta bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_all_delta = 0 AND p_public_delta = 0 THEN
        RETURN;
    END IF;

    IF p_all_delta < 0 OR p_public_delta < 0 THEN
        UPDATE public.book_chapter_stat SET
            all_count = all_count + p_all_delta,
            public_count = public_count + p_public_delta,
            updated_at = now()
        WHERE book_unit_id = p_book_unit_id;

        UPDATE public.book_chapter_progress_stat AS stat SET
            all_completed_count = stat.all_completed_count + p_all_delta,
            public_completed_count = stat.public_completed_count + p_public_delta,
            updated_at = now()
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND stat.profile_id = progress.profile_id
          AND stat.book_unit_id = p_book_unit_id;
    ELSE
        UPDATE public.book_chapter_stat SET
            all_count = all_count + p_all_delta,
            public_count = public_count + p_public_delta,
            updated_at = now()
        WHERE book_unit_id = p_book_unit_id;
        IF NOT FOUND THEN
            INSERT INTO public.book_chapter_stat (book_unit_id, all_count, public_count)
            VALUES (p_book_unit_id, p_all_delta, p_public_delta);
        END IF;

        UPDATE public.book_chapter_progress_stat AS stat SET
            all_completed_count = stat.all_completed_count + p_all_delta,
            public_completed_count = stat.public_completed_count + p_public_delta,
            updated_at = now()
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND stat.profile_id = progress.profile_id
          AND stat.book_unit_id = p_book_unit_id;

        INSERT INTO public.book_chapter_progress_stat (
            profile_id, book_unit_id, all_completed_count, public_completed_count
        )
        SELECT progress.profile_id, p_book_unit_id, p_all_delta, p_public_delta
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND NOT EXISTS (
              SELECT 1 FROM public.book_chapter_progress_stat AS existing
              WHERE existing.profile_id = progress.profile_id
                AND existing.book_unit_id = p_book_unit_id
          );
    END IF;
END
$$;


--
-- Name: apply_post_reply_stat_delta(uuid, uuid, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_post_reply_stat_delta(p_root_post_id uuid, p_parent_post_id uuid, p_undeleted_delta bigint, p_visible_delta bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF p_undeleted_delta = 0 AND p_visible_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE post_reply_stat SET
    undeleted_direct_count = undeleted_direct_count
      + CASE WHEN p_parent_post_id = p_root_post_id THEN p_undeleted_delta ELSE 0 END,
    undeleted_descendant_count = undeleted_descendant_count + p_undeleted_delta,
    visible_direct_count = visible_direct_count
      + CASE WHEN p_parent_post_id = p_root_post_id THEN p_visible_delta ELSE 0 END,
    visible_descendant_count = visible_descendant_count + p_visible_delta,
    updated_at = now()
  WHERE post_id = p_root_post_id;
  IF NOT FOUND AND EXISTS (SELECT 1 FROM post WHERE id = p_root_post_id) THEN
    RAISE EXCEPTION 'missing post_reply_stat row for root %', p_root_post_id
      USING ERRCODE = '23514';
  END IF;

  IF p_parent_post_id IS NOT NULL AND p_parent_post_id <> p_root_post_id THEN
    UPDATE post_reply_stat SET
      undeleted_direct_count = undeleted_direct_count + p_undeleted_delta,
      visible_direct_count = visible_direct_count + p_visible_delta,
      updated_at = now()
    WHERE post_id = p_parent_post_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM post WHERE id = p_parent_post_id) THEN
      RAISE EXCEPTION 'missing post_reply_stat row for parent %', p_parent_post_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$$;


--
-- Name: apply_reaction_change(uuid, uuid, uuid, text, timestamp with time zone, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_reaction_change(p_profile_id uuid, p_unit_id uuid, p_realm_id uuid, p_reaction text, p_occurred_at timestamp with time zone, p_direction bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE unit_weight double precision; profile_weight double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN RETURN; END IF;

  IF p_realm_id IS NULL OR EXISTS (SELECT 1 FROM realm WHERE id = p_realm_id) THEN
    IF p_direction < 0 THEN
      UPDATE unit_reaction_stat SET reaction_count = reaction_count + p_direction,
        updated_at = now()
      WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
        AND reaction = p_reaction::reaction_kind;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing unit_reaction_stat row for decrement: %, %, %',
          p_unit_id, p_realm_id, p_reaction USING ERRCODE = '23514';
      END IF;
    ELSE
      INSERT INTO unit_reaction_stat (unit_id, realm_id, reaction, reaction_count)
      VALUES (p_unit_id, p_realm_id, p_reaction::reaction_kind, p_direction)
      ON CONFLICT (unit_id, realm_id, reaction) DO UPDATE SET
        reaction_count = unit_reaction_stat.reaction_count + excluded.reaction_count,
        updated_at = now();
    END IF;
    DELETE FROM unit_reaction_stat
    WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
      AND reaction = p_reaction::reaction_kind AND reaction_count = 0;
  END IF;

  IF p_direction < 0 THEN
    UPDATE unit_reaction_global_stat SET reaction_count = reaction_count + p_direction,
      updated_at = now()
    WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing unit_reaction_global_stat row for decrement: %, %',
        p_unit_id, p_reaction USING ERRCODE = '23514';
    END IF;
  ELSE
    INSERT INTO unit_reaction_global_stat (unit_id, reaction, reaction_count)
    VALUES (p_unit_id, p_reaction::reaction_kind, p_direction)
    ON CONFLICT (unit_id, reaction) DO UPDATE SET
      reaction_count = unit_reaction_global_stat.reaction_count + excluded.reaction_count,
      updated_at = now();
  END IF;
  DELETE FROM unit_reaction_global_stat
  WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind AND reaction_count = 0;

  IF p_reaction = 'upvote' THEN
    PERFORM apply_unit_engagement_stat(p_unit_id, p_upvotes => p_direction);
    unit_weight := 3; profile_weight := 3;
  ELSE
    PERFORM apply_unit_engagement_stat(p_unit_id, p_downvotes => p_direction);
    unit_weight := 0; profile_weight := -4;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    p_unit_id, p_occurred_at, p_reaction,
    p_direction, p_direction * unit_weight
  );
  PERFORM apply_recommendation_profile_signal(
    p_profile_id, p_unit_id, p_occurred_at, p_reaction,
    p_direction, p_direction * profile_weight
  );
END;
$$;


--
-- Name: apply_recommendation_profile_signal(uuid, uuid, timestamp with time zone, text, bigint, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_recommendation_profile_signal(p_profile_id uuid, p_unit_id uuid, p_occurred_at timestamp with time zone, p_kind text, p_count_delta bigint, p_weight_delta double precision) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  bucket timestamptz := date_bin(interval '1 hour', p_occurred_at, timestamptz '2000-01-01 00:00:00+00');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profile WHERE id = p_profile_id)
    OR NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN
    RETURN;
  END IF;
  IF p_count_delta < 0 THEN
    UPDATE recommendation_profile_signal_hourly SET
      signal_count = signal_count + p_count_delta,
      weight = weight + p_weight_delta,
      updated_at = now()
    WHERE profile_id = p_profile_id AND unit_id = p_unit_id
      AND bucket_start = bucket AND kind = p_kind::recommendation_signal_kind;
  ELSE
    INSERT INTO recommendation_profile_signal_hourly (
      profile_id, unit_id, bucket_start, kind, signal_count, weight
    ) VALUES (
      p_profile_id, p_unit_id, bucket, p_kind::recommendation_signal_kind,
      p_count_delta, p_weight_delta
    )
    ON CONFLICT (profile_id, unit_id, bucket_start, kind) DO UPDATE SET
      signal_count = recommendation_profile_signal_hourly.signal_count + excluded.signal_count,
      weight = recommendation_profile_signal_hourly.weight + excluded.weight,
      updated_at = now();
  END IF;

  DELETE FROM recommendation_profile_signal_hourly
  WHERE profile_id = p_profile_id AND unit_id = p_unit_id AND bucket_start = bucket
    AND kind = p_kind::recommendation_signal_kind AND signal_count = 0 AND weight = 0;
END;
$$;


--
-- Name: apply_recommendation_unit_signal(uuid, timestamp with time zone, text, bigint, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_recommendation_unit_signal(p_unit_id uuid, p_occurred_at timestamp with time zone, p_kind text, p_count_delta bigint, p_weight_delta double precision) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  bucket timestamptz := date_bin(interval '1 hour', p_occurred_at, timestamptz '2000-01-01 00:00:00+00');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN
    RETURN;
  END IF;
  IF p_count_delta < 0 THEN
    UPDATE recommendation_unit_signal_hourly SET
      signal_count = signal_count + p_count_delta,
      weight = weight + p_weight_delta,
      updated_at = now()
    WHERE unit_id = p_unit_id AND bucket_start = bucket
      AND kind = p_kind::recommendation_signal_kind;
  ELSE
    INSERT INTO recommendation_unit_signal_hourly (
      unit_id, bucket_start, kind, signal_count, weight
    ) VALUES (
      p_unit_id, bucket, p_kind::recommendation_signal_kind, p_count_delta, p_weight_delta
    )
    ON CONFLICT (unit_id, bucket_start, kind) DO UPDATE SET
      signal_count = recommendation_unit_signal_hourly.signal_count + excluded.signal_count,
      weight = recommendation_unit_signal_hourly.weight + excluded.weight,
      updated_at = now();
  END IF;

  DELETE FROM recommendation_unit_signal_hourly
  WHERE unit_id = p_unit_id AND bucket_start = bucket
    AND kind = p_kind::recommendation_signal_kind
    AND signal_count = 0 AND weight = 0;
END;
$$;


--
-- Name: apply_unit_engagement_stat(uuid, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_unit_engagement_stat(p_unit_id uuid, p_upvotes bigint DEFAULT 0, p_downvotes bigint DEFAULT 0, p_replies bigint DEFAULT 0, p_favorites bigint DEFAULT 0, p_shares bigint DEFAULT 0, p_high_scores bigint DEFAULT 0, p_active_progress bigint DEFAULT 0, p_completions bigint DEFAULT 0, p_negative_progress bigint DEFAULT 0) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unit WHERE id = p_unit_id) THEN
    RETURN;
  END IF;
  IF p_upvotes = 0 AND p_downvotes = 0 AND p_replies = 0 AND p_favorites = 0
    AND p_shares = 0 AND p_high_scores = 0 AND p_active_progress = 0
    AND p_completions = 0 AND p_negative_progress = 0 THEN
    RETURN;
  END IF;

  UPDATE unit_engagement_stat SET
    upvotes = upvotes + p_upvotes,
    downvotes = downvotes + p_downvotes,
    replies = replies + p_replies,
    favorites = favorites + p_favorites,
    shares = shares + p_shares,
    high_scores = high_scores + p_high_scores,
    active_progress = active_progress + p_active_progress,
    completions = completions + p_completions,
    negative_progress = negative_progress + p_negative_progress,
    updated_at = now()
  WHERE unit_id = p_unit_id;

  IF NOT FOUND THEN
    IF p_upvotes < 0 OR p_downvotes < 0 OR p_replies < 0 OR p_favorites < 0
      OR p_shares < 0 OR p_high_scores < 0 OR p_active_progress < 0
      OR p_completions < 0 OR p_negative_progress < 0 THEN
      RAISE EXCEPTION 'missing unit_engagement_stat row for decrement: %', p_unit_id
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO unit_engagement_stat (
      unit_id, upvotes, downvotes, replies, favorites, shares, high_scores,
      active_progress, completions, negative_progress
    ) VALUES (
      p_unit_id, p_upvotes, p_downvotes, p_replies, p_favorites, p_shares,
      p_high_scores, p_active_progress, p_completions, p_negative_progress
    )
    ON CONFLICT (unit_id) DO UPDATE SET
      upvotes = unit_engagement_stat.upvotes + excluded.upvotes,
      downvotes = unit_engagement_stat.downvotes + excluded.downvotes,
      replies = unit_engagement_stat.replies + excluded.replies,
      favorites = unit_engagement_stat.favorites + excluded.favorites,
      shares = unit_engagement_stat.shares + excluded.shares,
      high_scores = unit_engagement_stat.high_scores + excluded.high_scores,
      active_progress = unit_engagement_stat.active_progress + excluded.active_progress,
      completions = unit_engagement_stat.completions + excluded.completions,
      negative_progress = unit_engagement_stat.negative_progress + excluded.negative_progress,
      updated_at = now();
  END IF;

  DELETE FROM unit_engagement_stat
  WHERE unit_id = p_unit_id AND upvotes = 0 AND downvotes = 0 AND replies = 0
    AND favorites = 0 AND shares = 0 AND high_scores = 0 AND active_progress = 0
    AND completions = 0 AND negative_progress = 0;
END;
$$;


--
-- Name: assert_post_targeting_allowed(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_post_targeting_allowed(p_source_post_id uuid, p_targets jsonb, p_explicit_realm_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  target_record record;
  realm_record record;
  target_locked boolean;
BEGIN
  IF p_targets IS NULL OR jsonb_array_length(p_targets) = 0 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_post_id::text, 4));

  FOR target_record IN
    SELECT DISTINCT ON (target_id)
      target_id,
      relation
    FROM jsonb_to_recordset(p_targets) AS target(target_id uuid, relation text)
    ORDER BY
      target_id,
      CASE relation WHEN 'subject' THEN 0 WHEN 'root' THEN 1 WHEN 'parent' THEN 2 END
  LOOP
    SELECT target.post_targeting_locked
      INTO target_locked
      FROM public.unit AS target
      WHERE target.id = target_record.target_id
      FOR SHARE;
    IF target_locked THEN
      RAISE EXCEPTION 'Post target does not accept new Post relations'
        USING
          ERRCODE = '23514',
          CONSTRAINT = 'post_targeting_global_unlocked',
          DETAIL = jsonb_build_object(
            'scope', 'global',
            'relation', target_record.relation,
            'targetUnitId', target_record.target_id
          )::text;
    END IF;
  END LOOP;

  FOR realm_record IN
    SELECT realm_id
    FROM (
      SELECT source_realm.realm_id
      FROM public.realm_unit AS source_realm
      WHERE source_realm.unit_id = p_source_post_id
        AND source_realm.publication_state = 'active'
      UNION
      SELECT p_explicit_realm_id
      WHERE p_explicit_realm_id IS NOT NULL
    ) AS source_realms
    ORDER BY realm_id
  LOOP
    FOR target_record IN
      SELECT DISTINCT ON (target_id)
        target_id,
        relation
      FROM jsonb_to_recordset(p_targets) AS target(target_id uuid, relation text)
      ORDER BY
        target_id,
        CASE relation WHEN 'subject' THEN 0 WHEN 'root' THEN 1 WHEN 'parent' THEN 2 END
    LOOP
      SELECT realm_target.post_targeting_locked
        INTO target_locked
        FROM public.realm_unit AS realm_target
        WHERE realm_target.realm_id = realm_record.realm_id
          AND realm_target.unit_id = target_record.target_id
          AND realm_target.publication_state = 'active'
        FOR SHARE;
      IF target_locked THEN
        RAISE EXCEPTION 'Post target does not accept new Post relations in this Realm'
          USING
            ERRCODE = '23514',
            CONSTRAINT = 'post_targeting_realm_unlocked',
            DETAIL = jsonb_build_object(
              'scope', 'realm',
              'relation', target_record.relation,
              'targetUnitId', target_record.target_id,
              'realmId', realm_record.realm_id
            )::text;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;


--
-- Name: book_chapter_node_scope(uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.book_chapter_node_scope(p_structure_id uuid, p_content_unit_id uuid, p_node_deleted_at timestamp with time zone) RETURNS TABLE(book_unit_id uuid, all_eligible boolean, public_eligible boolean)
    LANGUAGE sql STABLE
    AS $$
SELECT
    structure.owner_unit_id,
    structure.kind = 'book.contents'
        AND structure.deleted_at IS NULL
        AND p_node_deleted_at IS NULL
        AND content_unit.kind = 'post'
        AND content_unit.deleted_at IS NULL
        AND content_post.kind = 'chapter' AS all_eligible,
    structure.kind = 'book.contents'
        AND structure.deleted_at IS NULL
        AND p_node_deleted_at IS NULL
        AND content_unit.kind = 'post'
        AND content_unit.deleted_at IS NULL
        AND content_post.kind = 'chapter'
        AND content_unit.status = 'published'
        AND content_unit.visibility IN ('public', 'unlisted') AS public_eligible
FROM public.content_structure AS structure
JOIN public.unit AS content_unit ON content_unit.id = p_content_unit_id
LEFT JOIN public.post AS content_post ON content_post.id = content_unit.id
WHERE structure.id = p_structure_id
$$;


--
-- Name: content_structure_node_reject_cycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.content_structure_node_reject_cycle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT node.id, node.parent_id
      FROM content_structure_node AS node
      WHERE node.id = NEW.parent_id AND node.structure_id = NEW.structure_id
      UNION ALL
      SELECT parent.id, parent.parent_id
      FROM content_structure_node AS parent
      JOIN ancestors AS child ON child.parent_id = parent.id
      WHERE parent.structure_id = NEW.structure_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'content_structure_node cycle detected'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: current_search_metadata_v1(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_search_metadata_v1(title text, summary text, description jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT coalesce(title, '') || E'\n' || coalesce(summary, '') || E'\n'
        || public.current_search_text_v1(description)
$$;


--
-- Name: current_search_text_v1(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_search_text_v1(document jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT coalesce(
        string_agg(child ->> 'text', E'\n' ORDER BY block.ordinality, child_row.ordinality),
        ''::text
    )
    FROM jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(document) = 'object' AND document ->> '_type' = 'portable-text'
                THEN coalesce(document -> 'content', '[]'::jsonb)
            WHEN jsonb_typeof(document) = 'array' THEN document
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS block(value, ordinality)
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN block.value ->> '_type' = 'block'
                THEN coalesce(block.value -> 'children', '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS child_row(child, ordinality)
    WHERE child ->> '_type' = 'span' AND jsonb_typeof(child -> 'text') = 'string'
$$;


--
-- Name: enforce_post_realm_mount_targeting(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_post_realm_mount_targeting() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  targets jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(target), '[]'::jsonb)
    INTO targets
    FROM (
      SELECT jsonb_build_object(
        'target_id', stored_post.subject_unit_id,
        'relation', 'subject'
      ) AS target
      FROM public.post AS stored_post
      WHERE stored_post.id = NEW.unit_id
        AND stored_post.subject_unit_id IS NOT NULL

      UNION ALL

      SELECT jsonb_build_object(
        'target_id', stored_reply.root_post_id,
        'relation', 'root'
      )
      FROM public.post_reply AS stored_reply
      WHERE stored_reply.post_id = NEW.unit_id

      UNION ALL

      SELECT jsonb_build_object(
        'target_id', stored_reply.parent_post_id,
        'relation', 'parent'
      )
      FROM public.post_reply AS stored_reply
      WHERE stored_reply.post_id = NEW.unit_id
        AND stored_reply.parent_post_id IS NOT NULL
    ) AS post_targets;

  IF jsonb_array_length(targets) > 0 THEN
    PERFORM public.assert_post_targeting_allowed(NEW.unit_id, targets, NEW.realm_id);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: enforce_post_reply_targeting(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_post_reply_targeting() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  targets jsonb;
  should_check boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    should_check := true;
  ELSE
    should_check :=
      NEW.root_post_id IS DISTINCT FROM OLD.root_post_id OR
      NEW.parent_post_id IS DISTINCT FROM OLD.parent_post_id;
  END IF;

  IF should_check THEN
    targets := jsonb_build_array(jsonb_build_object(
      'target_id', NEW.root_post_id,
      'relation', 'root'
    ));
    IF NEW.parent_post_id IS NOT NULL THEN
      targets := targets || jsonb_build_array(jsonb_build_object(
        'target_id', NEW.parent_post_id,
        'relation', 'parent'
      ));
    END IF;
    PERFORM public.assert_post_targeting_allowed(NEW.post_id, targets);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: enforce_post_subject_targeting(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_post_subject_targeting() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.subject_unit_id IS NOT NULL THEN
      PERFORM public.assert_post_targeting_allowed(
        NEW.id,
        jsonb_build_array(jsonb_build_object(
          'target_id', NEW.subject_unit_id,
          'relation', 'subject'
        ))
      );
    END IF;
  ELSIF NEW.subject_unit_id IS DISTINCT FROM OLD.subject_unit_id
    AND NEW.subject_unit_id IS NOT NULL THEN
    PERFORM public.assert_post_targeting_allowed(
      NEW.id,
      jsonb_build_array(jsonb_build_object(
        'target_id', NEW.subject_unit_id,
        'relation', 'subject'
      ))
    );
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: enforce_realm_tag_context_wiki_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_realm_tag_context_wiki_post() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "post"
    WHERE "post"."id" = NEW."context_post_id"
      AND "post"."kind" = 'wiki'
  ) THEN
    RAISE EXCEPTION 'Realm Tag Context Post % must be a Wiki Post', NEW."context_post_id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_realm_tag_voting_enabled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_realm_tag_voting_enabled() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  PERFORM 1
  FROM public.realm
  WHERE id = NEW.realm_id
    AND realm_tag_voting_enabled
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Realm-scoped Tag voting is not enabled for Realm %', NEW.realm_id
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'realm_tag_vote_realm_tag_voting_enabled';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_realm_taxonomy_tag_query_strategy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_realm_taxonomy_tag_query_strategy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  is_realm_taxonomy_tag boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM "content_structure"
    INNER JOIN "tag" ON "tag"."id" = NEW."content_unit_id"
    WHERE "content_structure"."id" = NEW."structure_id"
      AND "content_structure"."kind" = 'realm.taxonomy'
  ) INTO is_realm_taxonomy_tag;

  IF is_realm_taxonomy_tag AND NEW."realm_tag_query_strategy" IS NULL THEN
    NEW."realm_tag_query_strategy" := 'global_effective';
  ELSIF NOT is_realm_taxonomy_tag AND NEW."realm_tag_query_strategy" IS NOT NULL THEN
    RAISE EXCEPTION
      'Realm Tag query strategy is only valid for Realm taxonomy Tag nodes'
      USING ERRCODE = '23514';
  END IF;
  IF is_realm_taxonomy_tag AND NEW."deleted_at" IS NULL AND EXISTS (
    SELECT 1
    FROM "content_structure_node" AS existing
    WHERE existing."structure_id" = NEW."structure_id"
      AND existing."content_unit_id" = NEW."content_unit_id"
      AND existing."deleted_at" IS NULL
      AND existing."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION
      'A Realm taxonomy can contain a Tag only once'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_unit_variant_star(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_unit_variant_star() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM id
  FROM unit
  WHERE id IN (NEW.variant_unit_id, NEW.main_unit_id)
  ORDER BY id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM unit_variant target_relationship
    WHERE target_relationship.variant_unit_id = NEW.main_unit_id
  ) THEN
    RAISE EXCEPTION 'a Variant must point directly to a Main'
      USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_target_is_variant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unit_variant child_relationship
    WHERE child_relationship.main_unit_id = NEW.variant_unit_id
  ) THEN
    RAISE EXCEPTION 'a Main with Variants cannot become a Variant'
      USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_source_has_variants';
  END IF;

  RETURN NEW;
END
$$;


--
-- Name: enforce_wiki_association_context_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_wiki_association_context_post() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.context_post_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM post
    WHERE id = NEW.context_post_id
      AND kind = 'wiki'::post_kind
  ) THEN
    RAISE EXCEPTION 'association context post % must be a wiki Post', NEW.context_post_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: guard_unit_content_license_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_unit_content_license_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'unit_content_license history is immutable';
  END IF;

  IF ROW(
    NEW."id",
    NEW."unit_id",
    NEW."granted_by_profile_id",
    NEW."reference_license_slug",
    NEW."granted_at"
  ) IS DISTINCT FROM ROW(
    OLD."id",
    OLD."unit_id",
    OLD."granted_by_profile_id",
    OLD."reference_license_slug",
    OLD."granted_at"
  ) THEN
    RAISE EXCEPTION 'unit_content_license grant facts are immutable';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: initialize_collection_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_collection_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO collection_stat (collection_id) VALUES (NEW.id);
  RETURN NULL;
END;
$$;


--
-- Name: initialize_conversation_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_conversation_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO conversation_stat (conversation_id) VALUES (NEW.id);
  INSERT INTO conversation_participant_stat (conversation_id, profile_id, sort_at)
  VALUES (NEW.id, NEW.participant_low_profile_id, NEW.created_at),
    (NEW.id, NEW.participant_high_profile_id, NEW.created_at);
  RETURN NULL;
END;
$$;


--
-- Name: initialize_notification_recipient_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_notification_recipient_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO public.notification_recipient_stat (profile_id)
    VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END
$$;


--
-- Name: initialize_poll_option_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_poll_option_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO poll_option_vote_stat (option_id) VALUES (NEW.id);
  RETURN NULL;
END;
$$;


--
-- Name: initialize_post_reply_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_post_reply_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO post_reply_stat (post_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;


--
-- Name: initialize_realm_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_realm_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO public.realm_stat (realm_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END
$$;


--
-- Name: initialize_realm_unit_moderation_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_realm_unit_moderation_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO public.realm_unit_moderation_stat (realm_id, unit_id)
    VALUES (NEW.realm_id, NEW.unit_id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END
$$;


--
-- Name: lock_unit_effective_tag_key(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_unit_effective_tag_key(target_unit_id uuid, target_tag_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    target_unit_id::text || ':' || target_tag_id::text,
    71001
  ))
$$;


--
-- Name: lock_unit_effective_tag_vote_key(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_unit_effective_tag_vote_key(target_unit_id uuid, target_tag_id uuid, target_profile_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    target_unit_id::text || ':' || target_tag_id::text || ':' || target_profile_id::text,
    71002
  ))
$$;


--
-- Name: lock_unit_structure_definition_key(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_unit_structure_definition_key(target_structure_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    target_structure_id::text,
    71005
  ))
$$;


--
-- Name: maintain_book_chapter_from_node(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_book_chapter_from_node() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_scope record;
    new_scope record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT * INTO old_scope FROM public.book_chapter_node_scope(
            OLD.structure_id, OLD.content_unit_id, OLD.deleted_at
        );
        IF old_scope.all_eligible THEN
            PERFORM public.apply_book_chapter_delta(
                old_scope.book_unit_id,
                OLD.id,
                -1,
                CASE WHEN old_scope.public_eligible THEN -1 ELSE 0 END
            );
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT * INTO new_scope FROM public.book_chapter_node_scope(
            NEW.structure_id, NEW.content_unit_id, NEW.deleted_at
        );
        IF new_scope.all_eligible THEN
            PERFORM public.apply_book_chapter_delta(
                new_scope.book_unit_id,
                NEW.id,
                1,
                CASE WHEN new_scope.public_eligible THEN 1 ELSE 0 END
            );
        END IF;
    END IF;
    RETURN NULL;
END
$$;


--
-- Name: maintain_book_chapter_from_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_book_chapter_from_post() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    occurrence record;
    content_unit public.unit%ROWTYPE;
    old_chapter boolean := TG_OP <> 'INSERT' AND OLD.kind = 'chapter';
    new_chapter boolean := TG_OP <> 'DELETE' AND NEW.kind = 'chapter';
    common_active boolean;
BEGIN
    SELECT * INTO content_unit FROM public.unit WHERE id = coalesce(NEW.id, OLD.id);
    FOR occurrence IN
        SELECT node.id, node.deleted_at, structure.owner_unit_id,
               structure.kind, structure.deleted_at AS structure_deleted_at
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = coalesce(NEW.id, OLD.id)
    LOOP
        common_active := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND content_unit.kind = 'post'
            AND content_unit.deleted_at IS NULL;
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN common_active AND new_chapter THEN 1 ELSE 0 END)
                - (CASE WHEN common_active AND old_chapter THEN 1 ELSE 0 END),
            (CASE WHEN common_active AND new_chapter AND content_unit.status = 'published'
                    AND content_unit.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
                - (CASE WHEN common_active AND old_chapter AND content_unit.status = 'published'
                    AND content_unit.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;


--
-- Name: maintain_book_chapter_from_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_book_chapter_from_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    scope record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT chapter_scope.* INTO scope
        FROM public.content_structure_node AS node
        CROSS JOIN LATERAL public.book_chapter_node_scope(
            node.structure_id, node.content_unit_id, node.deleted_at
        ) AS chapter_scope
        WHERE node.id = OLD.node_id;
        IF scope.all_eligible THEN
            UPDATE public.book_chapter_progress_stat SET
                all_completed_count = all_completed_count - 1,
                public_completed_count = public_completed_count
                    - CASE WHEN scope.public_eligible THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE profile_id = OLD.profile_id AND book_unit_id = scope.book_unit_id;
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT chapter_scope.* INTO scope
        FROM public.content_structure_node AS node
        CROSS JOIN LATERAL public.book_chapter_node_scope(
            node.structure_id, node.content_unit_id, node.deleted_at
        ) AS chapter_scope
        WHERE node.id = NEW.node_id;
        IF scope.all_eligible THEN
            INSERT INTO public.book_chapter_progress_stat (
                profile_id, book_unit_id, all_completed_count, public_completed_count
            ) VALUES (
                NEW.profile_id,
                scope.book_unit_id,
                1,
                CASE WHEN scope.public_eligible THEN 1 ELSE 0 END
            )
            ON CONFLICT (profile_id, book_unit_id) DO UPDATE SET
                all_completed_count = public.book_chapter_progress_stat.all_completed_count + 1,
                public_completed_count = public.book_chapter_progress_stat.public_completed_count
                    + EXCLUDED.public_completed_count,
                updated_at = now();
        END IF;
    END IF;
    RETURN NULL;
END
$$;


--
-- Name: maintain_book_chapter_from_structure(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_book_chapter_from_structure() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    occurrence record;
    old_active boolean := TG_OP <> 'INSERT'
        AND OLD.kind = 'book.contents' AND OLD.deleted_at IS NULL;
    new_active boolean := TG_OP <> 'DELETE'
        AND NEW.kind = 'book.contents' AND NEW.deleted_at IS NULL;
BEGIN
    IF old_active = new_active THEN
        RETURN NULL;
    END IF;
    FOR occurrence IN
        SELECT node.id, node.owner_unit_id, content_unit.status, content_unit.visibility
        FROM public.content_structure_node AS node
        JOIN public.unit AS content_unit ON content_unit.id = node.content_unit_id
        JOIN public.post AS content_post ON content_post.id = content_unit.id
        WHERE node.structure_id = coalesce(NEW.id, OLD.id)
          AND node.deleted_at IS NULL
          AND content_unit.kind = 'post'
          AND content_unit.deleted_at IS NULL
          AND content_post.kind = 'chapter'
    LOOP
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN new_active THEN 1 ELSE 0 END)
                - (CASE WHEN old_active THEN 1 ELSE 0 END),
            (CASE WHEN new_active AND occurrence.status = 'published'
                    AND occurrence.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
                - (CASE WHEN old_active AND occurrence.status = 'published'
                    AND occurrence.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;


--
-- Name: maintain_book_chapter_from_unit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_book_chapter_from_unit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    occurrence record;
    is_chapter boolean;
    old_all boolean;
    old_public boolean;
    new_all boolean;
    new_public boolean;
BEGIN
    SELECT kind = 'chapter' INTO is_chapter FROM public.post WHERE id = NEW.id;
    IF NOT coalesce(is_chapter, false) THEN
        RETURN NULL;
    END IF;
    FOR occurrence IN
        SELECT node.id, node.deleted_at, structure.owner_unit_id,
               structure.kind, structure.deleted_at AS structure_deleted_at
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = NEW.id
    LOOP
        old_all := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND OLD.kind = 'post' AND OLD.deleted_at IS NULL;
        new_all := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND NEW.kind = 'post' AND NEW.deleted_at IS NULL;
        old_public := old_all AND OLD.status = 'published'
            AND OLD.visibility IN ('public', 'unlisted');
        new_public := new_all AND NEW.status = 'published'
            AND NEW.visibility IN ('public', 'unlisted');
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN new_all THEN 1 ELSE 0 END) - (CASE WHEN old_all THEN 1 ELSE 0 END),
            (CASE WHEN new_public THEN 1 ELSE 0 END)
                - (CASE WHEN old_public THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;


--
-- Name: maintain_collection_item_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_collection_item_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.collection_id AS collection_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.collection_id AS collection_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE collection_stat
    SET item_count = item_count + changed.direction, updated_at = now()
    WHERE collection_id = changed.collection_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM collection WHERE id = changed.collection_id) THEN
      RAISE EXCEPTION 'missing collection_stat row for %', changed.collection_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_effective_tag_from_direct_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_effective_tag_from_direct_context() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_unit_effective_tag(
    coalesce(NEW.unit_id, OLD.unit_id),
    coalesce(NEW.tag_id, OLD.tag_id)
  );
  RETURN NULL;
END
$$;


--
-- Name: maintain_effective_tag_from_direct_vote(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_effective_tag_from_direct_vote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_unit_effective_tag_vote(
    coalesce(NEW.unit_id, OLD.unit_id),
    coalesce(NEW.tag_id, OLD.tag_id),
    coalesce(NEW.profile_id, OLD.profile_id)
  );
  RETURN NULL;
END
$$;


--
-- Name: maintain_effective_tag_from_structure_support(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_effective_tag_from_structure_support() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_unit_id uuid := coalesce(NEW.unit_id, OLD.unit_id);
  target_tag_id uuid := coalesce(NEW.tag_id, OLD.tag_id);
  target_profile_id uuid := coalesce(NEW.profile_id, OLD.profile_id);
BEGIN
  PERFORM refresh_unit_effective_tag(target_unit_id, target_tag_id);
  PERFORM refresh_unit_effective_tag_vote(
    target_unit_id,
    target_tag_id,
    target_profile_id
  );
  RETURN NULL;
END
$$;


--
-- Name: maintain_favorite_item_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_favorite_item_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data collection_item%ROWTYPE; direction bigint; is_favorite boolean; change record;
BEGIN
  IF TG_OP = 'UPDATE' AND
    (OLD.collection_id, OLD.unit_id, OLD.added_by_profile_id, OLD.created_at) IS NOT DISTINCT FROM
    (NEW.collection_id, NEW.unit_id, NEW.added_by_profile_id, NEW.created_at) THEN
    RETURN NULL;
  END IF;
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    SELECT EXISTS (
      SELECT 1 FROM profile_favorites_collection
      WHERE collection_id = row_data.collection_id
    ) INTO is_favorite;
    IF is_favorite THEN
      PERFORM apply_unit_engagement_stat(row_data.unit_id, p_favorites => direction);
      PERFORM apply_recommendation_unit_signal(
        row_data.unit_id, row_data.created_at, 'favorite', direction, direction * 5
      );
      IF row_data.added_by_profile_id IS NOT NULL THEN
        PERFORM apply_recommendation_profile_signal(
          row_data.added_by_profile_id, row_data.unit_id, row_data.created_at,
          'favorite', direction, direction * 5
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_message_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_message_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE recipient_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversation_stat SET last_message_id = NEW.id, last_message_at = NEW.created_at,
      updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    UPDATE conversation_participant_stat SET last_message_id = NEW.id,
      last_message_at = NEW.created_at, sort_at = NEW.created_at, updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    SELECT CASE WHEN participant_low_profile_id = NEW.sender_profile_id
      THEN participant_high_profile_id ELSE participant_low_profile_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF NEW.deleted_at IS NULL AND message_is_unread(
      NEW.conversation_id, recipient_id, NEW.created_at, NEW.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count + 1,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND profile_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    SELECT CASE WHEN participant_low_profile_id = NEW.sender_profile_id
      THEN participant_high_profile_id ELSE participant_low_profile_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF message_is_unread(NEW.conversation_id, recipient_id, NEW.created_at, NEW.id) THEN
      UPDATE conversation_participant_stat SET
        unread_count = unread_count + CASE
          WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN -1
          WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND profile_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT CASE WHEN participant_low_profile_id = OLD.sender_profile_id
      THEN participant_high_profile_id ELSE participant_low_profile_id END
    INTO recipient_id FROM conversation WHERE id = OLD.conversation_id;
    IF recipient_id IS NOT NULL AND OLD.deleted_at IS NULL AND message_is_unread(
      OLD.conversation_id, recipient_id, OLD.created_at, OLD.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count - 1,
        updated_at = now()
      WHERE conversation_id = OLD.conversation_id AND profile_id = recipient_id;
    END IF;
    PERFORM refresh_conversation_last_message(OLD.conversation_id);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_notification_recipient_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_notification_recipient_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_delta bigint := CASE
        WHEN TG_OP <> 'INSERT' AND OLD.in_app_visible AND OLD.read_at IS NULL THEN -1 ELSE 0 END;
    new_delta bigint := CASE
        WHEN TG_OP <> 'DELETE' AND NEW.in_app_visible AND NEW.read_at IS NULL THEN 1 ELSE 0 END;
BEGIN
    IF TG_OP <> 'INSERT' AND old_delta <> 0 THEN
        INSERT INTO public.notification_recipient_stat (profile_id, unread_count)
        VALUES (OLD.recipient_profile_id, old_delta)
        ON CONFLICT (profile_id) DO UPDATE SET
            unread_count = public.notification_recipient_stat.unread_count + EXCLUDED.unread_count,
            updated_at = now();
    END IF;
    IF TG_OP <> 'DELETE' AND new_delta <> 0 THEN
        INSERT INTO public.notification_recipient_stat (profile_id, unread_count)
        VALUES (NEW.recipient_profile_id, new_delta)
        ON CONFLICT (profile_id) DO UPDATE SET
            unread_count = public.notification_recipient_stat.unread_count + EXCLUDED.unread_count,
            updated_at = now();
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;


--
-- Name: maintain_poll_option_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_poll_option_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.option_id AS option_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.option_id AS option_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE poll_option_vote_stat
    SET vote_count = vote_count + changed.direction, updated_at = now()
    WHERE option_id = changed.option_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM poll_option WHERE id = changed.option_id) THEN
      RAISE EXCEPTION 'missing poll_option_vote_stat row for %', changed.option_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_post_reply_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_post_reply_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE reply_unit unit%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO STRICT reply_unit FROM unit WHERE id = NEW.post_id;
    PERFORM apply_post_reply_stat_delta(
      NEW.root_post_id,
      NEW.parent_post_id,
      (reply_unit.deleted_at IS NULL)::int,
      (reply_unit.deleted_at IS NULL AND reply_unit.status = 'published'
        AND reply_unit.visibility = 'public'
        AND reply_unit.moderation_status = 'approved')::int
    );
    IF reply_unit.deleted_at IS NULL THEN
      PERFORM apply_unit_engagement_stat(NEW.root_post_id, p_replies => 1);
      IF NEW.parent_post_id IS NOT NULL THEN
        PERFORM apply_unit_engagement_stat(NEW.parent_post_id, p_replies => 1);
      END IF;
    END IF;
    PERFORM apply_recommendation_unit_signal(NEW.root_post_id, NEW.created_at, 'reply', 1, 4);
    IF NEW.parent_post_id IS NOT NULL THEN
      PERFORM apply_recommendation_unit_signal(
        NEW.parent_post_id, NEW.created_at, 'reply', 1, 4
      );
    END IF;
  ELSIF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM unit WHERE id = OLD.post_id) THEN
    SELECT * INTO STRICT reply_unit FROM unit WHERE id = OLD.post_id;
    PERFORM apply_post_reply_stat_delta(
      OLD.root_post_id,
      OLD.parent_post_id,
      -(reply_unit.deleted_at IS NULL)::int,
      -(reply_unit.deleted_at IS NULL AND reply_unit.status = 'published'
        AND reply_unit.visibility = 'public'
        AND reply_unit.moderation_status = 'approved')::int
    );
    IF reply_unit.deleted_at IS NULL THEN
      PERFORM apply_unit_engagement_stat(OLD.root_post_id, p_replies => -1);
      IF OLD.parent_post_id IS NOT NULL THEN
        PERFORM apply_unit_engagement_stat(OLD.parent_post_id, p_replies => -1);
      END IF;
    END IF;
    PERFORM apply_recommendation_unit_signal(OLD.root_post_id, OLD.created_at, 'reply', -1, -4);
    IF OLD.parent_post_id IS NOT NULL THEN
      PERFORM apply_recommendation_unit_signal(
        OLD.parent_post_id, OLD.created_at, 'reply', -1, -4
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_realm_member_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_realm_member_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_delta bigint := CASE WHEN TG_OP <> 'INSERT' AND OLD.state = 'active' THEN -1 ELSE 0 END;
    new_delta bigint := CASE WHEN TG_OP <> 'DELETE' AND NEW.state = 'active' THEN 1 ELSE 0 END;
BEGIN
    IF TG_OP <> 'INSERT' AND old_delta <> 0 THEN
        INSERT INTO public.realm_stat (realm_id, active_member_count)
        VALUES (OLD.realm_id, old_delta)
        ON CONFLICT (realm_id) DO UPDATE SET
            active_member_count = public.realm_stat.active_member_count + EXCLUDED.active_member_count,
            updated_at = now();
    END IF;
    IF TG_OP <> 'DELETE' AND new_delta <> 0 THEN
        INSERT INTO public.realm_stat (realm_id, active_member_count)
        VALUES (NEW.realm_id, new_delta)
        ON CONFLICT (realm_id) DO UPDATE SET
            active_member_count = public.realm_stat.active_member_count + EXCLUDED.active_member_count,
            updated_at = now();
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;


--
-- Name: maintain_realm_tag_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_realm_tag_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  row_data realm_tag_vote%ROWTYPE;
  direction bigint;
  change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data;
    direction := change.direction;
    IF direction < 0 THEN
      UPDATE realm_tag_vote_stat
      SET
        score = score + direction * row_data.value,
        vote_count = vote_count + direction,
        updated_at = now()
      WHERE realm_id = row_data.realm_id
        AND unit_id = row_data.unit_id
        AND tag_id = row_data.tag_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing realm_tag_vote_stat row for decrement: %, %, %',
          row_data.realm_id, row_data.unit_id, row_data.tag_id
          USING ERRCODE = '23514';
      END IF;
    ELSE
      INSERT INTO realm_tag_vote_stat (realm_id, unit_id, tag_id, score, vote_count)
      VALUES (
        row_data.realm_id,
        row_data.unit_id,
        row_data.tag_id,
        direction * row_data.value,
        direction
      )
      ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
        score = realm_tag_vote_stat.score + excluded.score,
        vote_count = realm_tag_vote_stat.vote_count + excluded.vote_count,
        updated_at = now();
    END IF;
    DELETE FROM realm_tag_vote_stat
    WHERE realm_id = row_data.realm_id
      AND unit_id = row_data.unit_id
      AND tag_id = row_data.tag_id
      AND vote_count = 0;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_realm_unit_report_case_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_realm_unit_report_case_state() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    delta bigint :=
        CASE WHEN NEW.state IN ('new', 'triaged', 'assigned', 'escalated', 'reviewing')
            THEN 1 ELSE 0 END
        - CASE WHEN OLD.state IN ('new', 'triaged', 'assigned', 'escalated', 'reviewing')
            THEN 1 ELSE 0 END;
BEGIN
    IF delta <> 0 THEN
        INSERT INTO public.realm_unit_moderation_stat (
            realm_id, unit_id, open_report_count
        )
        SELECT realm_id, unit_id, count(*) * delta
        FROM public.realm_unit_report
        WHERE case_id = NEW.id
        GROUP BY realm_id, unit_id
        ON CONFLICT (realm_id, unit_id) DO UPDATE SET
            open_report_count = public.realm_unit_moderation_stat.open_report_count
                + EXCLUDED.open_report_count,
            updated_at = now();
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: maintain_realm_unit_report_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_realm_unit_report_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_delta bigint := 0;
    new_delta bigint := 0;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT CASE WHEN state IN ('new', 'triaged', 'assigned', 'escalated', 'reviewing')
            THEN -1 ELSE 0 END INTO old_delta
        FROM public.moderation_case WHERE id = OLD.case_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT CASE WHEN state IN ('new', 'triaged', 'assigned', 'escalated', 'reviewing')
            THEN 1 ELSE 0 END INTO new_delta
        FROM public.moderation_case WHERE id = NEW.case_id;
    END IF;
    IF TG_OP <> 'INSERT' AND old_delta <> 0 THEN
        UPDATE public.realm_unit_moderation_stat SET
            open_report_count = open_report_count + old_delta,
            updated_at = now()
        WHERE realm_id = OLD.realm_id AND unit_id = OLD.unit_id;
    END IF;
    IF TG_OP <> 'DELETE' AND new_delta <> 0 THEN
        INSERT INTO public.realm_unit_moderation_stat (realm_id, unit_id, open_report_count)
        VALUES (NEW.realm_id, NEW.unit_id, new_delta)
        ON CONFLICT (realm_id, unit_id) DO UPDATE SET
            open_report_count = public.realm_unit_moderation_stat.open_report_count
                + EXCLUDED.open_report_count,
            updated_at = now();
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;


--
-- Name: maintain_recommendation_event_signals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_recommendation_event_signals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data recommendation_event%ROWTYPE; direction bigint;
unit_weight double precision; profile_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.profile_id IS NOT NULL
      AND row_data.type IN ('impression', 'open', 'dwell_30s', 'not_interested') THEN
      unit_weight := CASE row_data.type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 ELSE 0 END;
      profile_weight := CASE row_data.type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2
        WHEN 'not_interested' THEN -4 ELSE 0 END;
      PERFORM apply_recommendation_unit_signal(
        row_data.target_unit_id, row_data.occurred_at,
        row_data.type::text, direction, direction * unit_weight
      );
      IF row_data.type <> 'impression' THEN
        PERFORM apply_recommendation_profile_signal(
          row_data.profile_id, row_data.target_unit_id, row_data.occurred_at,
          row_data.type::text, direction,
          direction * profile_weight
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_reply_unit_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_reply_unit_state() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE relation post_reply%ROWTYPE;
old_counted boolean;
new_counted boolean;
old_visible boolean;
new_visible boolean;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  old_counted := OLD.deleted_at IS NULL;
  new_counted := NEW.deleted_at IS NULL;
  old_visible := old_counted AND OLD.status = 'published' AND OLD.visibility = 'public'
    AND OLD.moderation_status = 'approved';
  new_visible := new_counted AND NEW.status = 'published' AND NEW.visibility = 'public'
    AND NEW.moderation_status = 'approved';
  IF old_counted IS DISTINCT FROM new_counted THEN
    PERFORM apply_unit_engagement_stat(
      relation.root_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
    );
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(
        relation.parent_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
      );
    END IF;
  END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    new_counted::int - old_counted::int,
    new_visible::int - old_visible::int
  );
  RETURN NULL;
END;
$$;


--
-- Name: maintain_score_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_score_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  row_data score%ROWTYPE;
  direction bigint;
  signal_kind text;
  unit_weight double precision;
  profile_weight double precision;
  change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data;
    direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit WHERE id = row_data.unit_id)
      AND EXISTS (SELECT 1 FROM realm WHERE id = row_data.realm_id) THEN
      IF direction < 0 THEN
        UPDATE score_stat SET
          total_count = total_count + direction,
          total_score = total_score + direction * row_data.value,
          score_1_count = score_1_count + direction * (row_data.value = 1)::int,
          score_2_count = score_2_count + direction * (row_data.value = 2)::int,
          score_3_count = score_3_count + direction * (row_data.value = 3)::int,
          score_4_count = score_4_count + direction * (row_data.value = 4)::int,
          score_5_count = score_5_count + direction * (row_data.value = 5)::int,
          score_6_count = score_6_count + direction * (row_data.value = 6)::int,
          score_7_count = score_7_count + direction * (row_data.value = 7)::int,
          score_8_count = score_8_count + direction * (row_data.value = 8)::int,
          score_9_count = score_9_count + direction * (row_data.value = 9)::int,
          score_10_count = score_10_count + direction * (row_data.value = 10)::int,
          updated_at = now()
        WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing score_stat row for decrement: %, %',
            row_data.unit_id, row_data.realm_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO score_stat (
          unit_id, realm_id, total_count, total_score,
          score_1_count, score_2_count, score_3_count, score_4_count, score_5_count,
          score_6_count, score_7_count, score_8_count, score_9_count, score_10_count
        ) VALUES (
          row_data.unit_id, row_data.realm_id, direction, direction * row_data.value,
          direction * (row_data.value = 1)::int, direction * (row_data.value = 2)::int,
          direction * (row_data.value = 3)::int, direction * (row_data.value = 4)::int,
          direction * (row_data.value = 5)::int, direction * (row_data.value = 6)::int,
          direction * (row_data.value = 7)::int, direction * (row_data.value = 8)::int,
          direction * (row_data.value = 9)::int, direction * (row_data.value = 10)::int
        )
        ON CONFLICT (unit_id, realm_id) DO UPDATE SET
          total_count = score_stat.total_count + excluded.total_count,
          total_score = score_stat.total_score + excluded.total_score,
          score_1_count = score_stat.score_1_count + excluded.score_1_count,
          score_2_count = score_stat.score_2_count + excluded.score_2_count,
          score_3_count = score_stat.score_3_count + excluded.score_3_count,
          score_4_count = score_stat.score_4_count + excluded.score_4_count,
          score_5_count = score_stat.score_5_count + excluded.score_5_count,
          score_6_count = score_stat.score_6_count + excluded.score_6_count,
          score_7_count = score_stat.score_7_count + excluded.score_7_count,
          score_8_count = score_stat.score_8_count + excluded.score_8_count,
          score_9_count = score_stat.score_9_count + excluded.score_9_count,
          score_10_count = score_stat.score_10_count + excluded.score_10_count,
          updated_at = now();
      END IF;
      DELETE FROM score_stat
      WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id AND total_count = 0;
    END IF;

    PERFORM apply_unit_engagement_stat(
      row_data.unit_id, p_high_scores => direction * (row_data.value >= 8)::int
    );
    IF row_data.value >= 8 THEN
      signal_kind := 'score_high'; unit_weight := 5; profile_weight := 5;
    ELSIF row_data.value >= 6 THEN
      signal_kind := 'score_medium'; unit_weight := 3; profile_weight := 3;
    ELSIF row_data.value <= 3 THEN
      signal_kind := 'score_low'; unit_weight := 0; profile_weight := -4;
    ELSE
      signal_kind := NULL; unit_weight := 0; profile_weight := 0;
    END IF;
    IF signal_kind IS NOT NULL THEN
      IF unit_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.updated_at, signal_kind, direction, direction * unit_weight
        );
      END IF;
      PERFORM apply_recommendation_profile_signal(
        row_data.profile_id, row_data.unit_id, row_data.updated_at, signal_kind,
        direction, direction * profile_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_structure_application_support(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_structure_application_support() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.value = -1 THEN
    DELETE FROM unit_tag_structure_support
    WHERE unit_id = coalesce(NEW.unit_id, OLD.unit_id)
      AND structure_id = coalesce(NEW.structure_id, OLD.structure_id)
      AND profile_id = coalesce(NEW.profile_id, OLD.profile_id);
  ELSE
    INSERT INTO unit_tag_structure_support (
      unit_id,
      tag_id,
      profile_id,
      structure_id
    )
    SELECT NEW.unit_id, member.member_unit_id, NEW.profile_id, NEW.structure_id
    FROM unit_structure_member member
    WHERE member.structure_id = NEW.structure_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END
$$;


--
-- Name: maintain_unit_alias_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_alias_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data unit_alias_vote%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit_alias WHERE id = row_data.alias_id) THEN
      IF direction < 0 THEN
        UPDATE unit_alias_vote_stat SET score = score + direction * row_data.value,
          vote_count = vote_count + direction, updated_at = now()
        WHERE alias_id = row_data.alias_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_alias_vote_stat row for decrement: %',
            row_data.alias_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_alias_vote_stat (alias_id, score, vote_count)
        VALUES (row_data.alias_id, direction * row_data.value, direction)
        ON CONFLICT (alias_id) DO UPDATE SET
          score = unit_alias_vote_stat.score + excluded.score,
          vote_count = unit_alias_vote_stat.vote_count + excluded.vote_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_alias_vote_stat WHERE alias_id = row_data.alias_id AND vote_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_unit_follow_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_follow_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data unit_follow%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit WHERE id = row_data.unit_id) THEN
      IF direction < 0 THEN
        UPDATE unit_follow_stat SET follower_count = follower_count + direction,
          updated_at = now() WHERE unit_id = row_data.unit_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_follow_stat row for decrement: %',
            row_data.unit_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_follow_stat (unit_id, follower_count)
        VALUES (row_data.unit_id, direction)
        ON CONFLICT (unit_id) DO UPDATE SET
          follower_count = unit_follow_stat.follower_count + excluded.follower_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_follow_stat WHERE unit_id = row_data.unit_id AND follower_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_unit_progress_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_progress_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data unit_progress%ROWTYPE; direction bigint;
signal_kind text; signal_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.deleted_at IS NULL AND row_data.status IN ('active', 'completed', 'dropped') THEN
      PERFORM apply_unit_engagement_stat(
        row_data.unit_id,
        p_active_progress => direction * (row_data.status = 'active')::int,
        p_completions => direction * (row_data.status = 'completed')::int,
        p_negative_progress => direction * (row_data.status = 'dropped')::int
      );
      signal_kind := CASE row_data.status WHEN 'active' THEN 'progress_active'
        WHEN 'completed' THEN 'progress_completed' ELSE 'progress_dropped' END;
      signal_weight := CASE row_data.status WHEN 'active' THEN 3
        WHEN 'completed' THEN 5 ELSE -4 END;
      IF signal_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.last_seen_at, signal_kind, direction,
          direction * signal_weight
        );
      END IF;
      PERFORM apply_recommendation_profile_signal(
        row_data.profile_id, row_data.unit_id, row_data.last_seen_at, signal_kind,
        direction, direction * signal_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_unit_reaction_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_reaction_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM apply_reaction_change(
      OLD.profile_id, OLD.unit_id, OLD.realm_id, OLD.reaction::text, OLD.updated_at, -1
    );
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    PERFORM apply_reaction_change(
      NEW.profile_id, NEW.unit_id, NEW.realm_id, NEW.reaction::text, NEW.updated_at, 1
    );
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_unit_share_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_share_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data unit_share%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    PERFORM apply_unit_engagement_stat(row_data.unit_id, p_shares => direction);
    PERFORM apply_recommendation_unit_signal(
      row_data.unit_id, row_data.created_at, 'share', direction, direction * 4
    );
    PERFORM apply_recommendation_profile_signal(
      row_data.profile_id, row_data.unit_id, row_data.created_at, 'share', direction,
      direction * 4
    );
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_unit_source_link_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_source_link_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE row_data unit_source_link_vote%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF EXISTS (SELECT 1 FROM unit_source_link WHERE id = row_data.link_id) THEN
      IF direction < 0 THEN
        UPDATE unit_source_link_vote_stat SET score = score + direction * row_data.value,
          vote_count = vote_count + direction, updated_at = now()
        WHERE link_id = row_data.link_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_source_link_vote_stat row for decrement: %',
            row_data.link_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_source_link_vote_stat (link_id, score, vote_count)
        VALUES (row_data.link_id, direction * row_data.value, direction)
        ON CONFLICT (link_id) DO UPDATE SET
          score = unit_source_link_vote_stat.score + excluded.score,
          vote_count = unit_source_link_vote_stat.vote_count + excluded.vote_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_source_link_vote_stat
      WHERE link_id = row_data.link_id AND vote_count = 0;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: maintain_unit_structure_application_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_structure_application_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_unit_structure_application_vote_stat(
    coalesce(NEW.unit_id, OLD.unit_id),
    coalesce(NEW.structure_id, OLD.structure_id)
  );
  RETURN NULL;
END
$$;


--
-- Name: maintain_unit_structure_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_structure_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_unit_structure_vote_stat(
    coalesce(NEW.structure_id, OLD.structure_id)
  );
  RETURN NULL;
END
$$;


--
-- Name: maintain_unit_tag_vote_stat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_unit_tag_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_unit_id uuid := coalesce(NEW.unit_id, OLD.unit_id);
  target_tag_id uuid := coalesce(NEW.tag_id, OLD.tag_id);
BEGIN
  PERFORM lock_unit_effective_tag_key(target_unit_id, target_tag_id);
  INSERT INTO unit_tag_vote_stat (unit_id, tag_id, score, vote_count)
  SELECT
    target_unit_id,
    target_tag_id,
    coalesce(sum(value), 0)::bigint,
    count(*)::bigint
  FROM unit_effective_tag_vote
  WHERE unit_id = target_unit_id AND tag_id = target_tag_id
  HAVING count(*) > 0
  ON CONFLICT (unit_id, tag_id) DO UPDATE SET
    score = excluded.score,
    vote_count = excluded.vote_count,
    updated_at = now();
  DELETE FROM unit_tag_vote_stat
  WHERE unit_id = target_unit_id
    AND tag_id = target_tag_id
    AND vote_count = 0;
  RETURN NULL;
END
$$;


--
-- Name: message_is_unread(uuid, uuid, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.message_is_unread(p_conversation_id uuid, p_recipient_id uuid, p_message_created_at timestamp with time zone, p_message_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT marker.id IS NULL OR (p_message_created_at, p_message_id) > (marker.created_at, marker.id)
  FROM (SELECT 1) seed
  LEFT JOIN conversation_read read_state
    ON read_state.conversation_id = p_conversation_id AND read_state.profile_id = p_recipient_id
  LEFT JOIN message marker ON marker.id = read_state.last_read_message_id;
$$;


--
-- Name: prepare_unit_structure_definition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_unit_structure_definition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  invalid_member_count integer;
BEGIN
  IF cardinality(NEW.member_unit_ids) <>
    (SELECT count(DISTINCT member_id) FROM unnest(NEW.member_unit_ids) member_id)
  THEN
    RAISE EXCEPTION 'Unit structure members must be distinct'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.kind = 'tag.hierarchy_path' THEN
    SELECT count(*) INTO invalid_member_count
    FROM unnest(NEW.member_unit_ids) member_id
    LEFT JOIN tag ON tag.id = member_id
    LEFT JOIN unit ON unit.id = member_id
    WHERE tag.id IS NULL
       OR unit.kind <> 'tag'
       OR unit.status <> 'published'
       OR unit.visibility <> 'public'
       OR unit.moderation_status <> 'approved'
       OR unit.deleted_at IS NOT NULL;
    IF invalid_member_count <> 0 THEN
      RAISE EXCEPTION 'Tag hierarchy paths require active public Tag members'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported Unit structure kind: %', NEW.kind
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM lock_unit_structure_definition_key(NEW.id);
    IF EXISTS (
      SELECT 1
      FROM unit_structure_application application
      WHERE application.structure_id = NEW.id
        AND application.unit_id = ANY(NEW.member_unit_ids)
    ) THEN
      RAISE EXCEPTION 'A Tag hierarchy path cannot contain an existing application target'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM unit_structure_application_vote application_vote
      CROSS JOIN unnest(NEW.member_unit_ids) member_id
      JOIN unit_tag_vote direct_vote
        ON direct_vote.unit_id = application_vote.unit_id
       AND direct_vote.tag_id = member_id
       AND direct_vote.profile_id = application_vote.profile_id
       AND direct_vote.value = -1
      WHERE application_vote.structure_id = NEW.id
        AND application_vote.value = 1
    ) THEN
      RAISE EXCEPTION 'Administrative Structure correction conflicts with a negative direct Tag vote'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: project_unit_structure_definition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_unit_structure_definition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM unit_structure_edge
    WHERE structure_id = NEW.id;
    DELETE FROM unit_structure_member
    WHERE structure_id = NEW.id;
  END IF;

  INSERT INTO unit_structure_member (
    structure_id,
    ordinal,
    member_unit_id
  )
  SELECT NEW.id, member.ordinality - 1, member.id
  FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality);

  INSERT INTO unit_structure_edge (
    structure_id,
    ordinal,
    parent_unit_id,
    child_unit_id
  )
  SELECT NEW.id, member.ordinality - 1, member.id, NEW.member_unit_ids[member.ordinality + 1]
  FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality)
  WHERE member.ordinality < cardinality(NEW.member_unit_ids);

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO unit_tag_structure_support (
      unit_id,
      tag_id,
      profile_id,
      structure_id
    )
    SELECT
      application_vote.unit_id,
      member.member_unit_id,
      application_vote.profile_id,
      application_vote.structure_id
    FROM unit_structure_application_vote application_vote
    JOIN unit_structure_member member
      ON member.structure_id = application_vote.structure_id
    WHERE application_vote.structure_id = NEW.id
      AND application_vote.value = 1
    ORDER BY
      application_vote.unit_id,
      member.member_unit_id,
      application_vote.profile_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: protect_association_context_post_kind(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_association_context_post_kind() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.kind = 'wiki'::post_kind
    AND NEW.kind <> 'wiki'::post_kind
    AND (
      EXISTS (
        SELECT 1 FROM subject_association
        WHERE context_post_id = OLD.id
      )
      OR EXISTS (
        SELECT 1 FROM unit_association_proposal
        WHERE context_post_id = OLD.id
      )
    )
  THEN
    RAISE EXCEPTION 'referenced association context post % must remain a wiki Post', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_conversation_aggregate_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_conversation_aggregate_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.id, OLD.participant_low_profile_id, OLD.participant_high_profile_id, OLD.created_at)
    IS DISTINCT FROM
    (NEW.id, NEW.participant_low_profile_id, NEW.participant_high_profile_id, NEW.created_at) THEN
    RAISE EXCEPTION 'conversation aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_conversation_read_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_conversation_read_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.conversation_id, OLD.profile_id) IS DISTINCT FROM (NEW.conversation_id, NEW.profile_id) THEN
    RAISE EXCEPTION 'conversation read identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_immutable_unit_structure(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_immutable_unit_structure() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_TABLE_NAME = 'unit_structure'
     AND TG_OP = 'UPDATE'
     AND current_setting('rezics.unit_structure_admin_edit_id', true) = OLD.id::text
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.unit_kind IS NOT DISTINCT FROM OLD.unit_kind
     AND NEW.kind IS NOT DISTINCT FROM OLD.kind
     AND NEW.definition_version IS NOT DISTINCT FROM OLD.definition_version
     AND NEW.created_by_profile_id IS NOT DISTINCT FROM OLD.created_by_profile_id
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Unit structure definitions and projections are immutable'
    USING ERRCODE = '55000';
END
$$;


--
-- Name: protect_message_aggregate_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_message_aggregate_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.id, OLD.conversation_id, OLD.sender_profile_id, OLD.created_at)
    IS DISTINCT FROM (NEW.id, NEW.conversation_id, NEW.sender_profile_id, NEW.created_at) THEN
    RAISE EXCEPTION 'message aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_post_reply_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_post_reply_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.post_id, OLD.root_post_id, OLD.parent_post_id, OLD.depth, OLD.created_at)
    IS DISTINCT FROM
    (NEW.post_id, NEW.root_post_id, NEW.parent_post_id, NEW.depth, NEW.created_at) THEN
    RAISE EXCEPTION 'post_reply identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_realm_tag_context_post_kind(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_realm_tag_context_post_kind() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD."kind" = 'wiki'
    AND NEW."kind" <> 'wiki'
    AND EXISTS (
      SELECT 1
      FROM "realm_tag_context"
      WHERE "context_post_id" = OLD."id"
    )
  THEN
    RAISE EXCEPTION 'Post % is a Realm Tag Context and must remain a Wiki Post', OLD."id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_unit_revision_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_unit_revision_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	IF ROW(
		OLD."id",
		OLD."unit_id",
		OLD."parent_revision_id",
		OLD."actor_profile_id",
		OLD."edit_summary",
		OLD."minor",
		OLD."byte_size",
		OLD."created_at"
	) IS DISTINCT FROM ROW(
		NEW."id",
		NEW."unit_id",
		NEW."parent_revision_id",
		NEW."actor_profile_id",
		NEW."edit_summary",
		NEW."minor",
		NEW."byte_size",
		NEW."created_at"
	) THEN
		RAISE EXCEPTION 'unit_revision identity is immutable' USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;


--
-- Name: refresh_book_localized_content_metric_stat(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_book_localized_content_metric_stat(p_book_unit_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM public.book_localized_content_metric_stat
    WHERE book_unit_id = p_book_unit_id;

    INSERT INTO public.book_localized_content_metric_stat (
        book_unit_id, language, chapter_count, word_count, character_count
    )
    SELECT p_book_unit_id, metric.language, count(*), sum(metric.word_count),
        sum(metric.character_count)
    FROM public.content_structure_node AS node
    JOIN public.content_structure AS structure
        ON structure.id = node.structure_id
        AND structure.owner_unit_id = node.owner_unit_id
    JOIN public.post AS content_post ON content_post.id = node.content_unit_id
    JOIN public.unit AS content_unit ON content_unit.id = node.content_unit_id
    JOIN public.unit_localization AS localization ON localization.unit_id = node.content_unit_id
    JOIN public.unit_localization_content_metric AS metric
        ON metric.unit_id = node.content_unit_id
        AND metric.language = localization.language
    WHERE structure.owner_unit_id = p_book_unit_id
      AND structure.kind = 'book.contents'
      AND structure.deleted_at IS NULL
      AND node.deleted_at IS NULL
      AND content_post.kind = 'chapter'
      AND content_unit.deleted_at IS NULL
      AND content_unit.status = 'published'
      AND content_unit.visibility IN ('public', 'unlisted')
      AND localization.content_status = 'published'
    GROUP BY metric.language;
END
$$;


--
-- Name: refresh_book_metric_from_content_unit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_book_metric_from_content_unit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    book_id uuid;
BEGIN
    FOR book_id IN
        SELECT DISTINCT node.owner_unit_id
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = coalesce(NEW.id, OLD.id)
          AND structure.kind = 'book.contents'
    LOOP
        PERFORM public.refresh_book_localized_content_metric_stat(book_id);
    END LOOP;
    RETURN NULL;
END
$$;


--
-- Name: refresh_book_metric_from_localization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_book_metric_from_localization() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    book_id uuid;
    p_content_unit_id uuid := coalesce(NEW.unit_id, OLD.unit_id);
BEGIN
    FOR book_id IN
        SELECT DISTINCT node.owner_unit_id
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = p_content_unit_id
          AND structure.kind = 'book.contents'
    LOOP
        PERFORM public.refresh_book_localized_content_metric_stat(book_id);
    END LOOP;
    RETURN NULL;
END
$$;


--
-- Name: refresh_book_metric_from_node(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_book_metric_from_node() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM public.refresh_book_localized_content_metric_stat(OLD.owner_unit_id);
    END IF;
    IF TG_OP <> 'DELETE' AND (
        TG_OP = 'INSERT' OR NEW.owner_unit_id IS DISTINCT FROM OLD.owner_unit_id
    ) THEN
        PERFORM public.refresh_book_localized_content_metric_stat(NEW.owner_unit_id);
    END IF;
    RETURN NULL;
END
$$;


--
-- Name: refresh_book_metric_from_structure(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_book_metric_from_structure() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM public.refresh_book_localized_content_metric_stat(OLD.owner_unit_id);
    END IF;
    IF TG_OP <> 'DELETE' AND (
        TG_OP = 'INSERT' OR NEW.owner_unit_id IS DISTINCT FROM OLD.owner_unit_id
    ) THEN
        PERFORM public.refresh_book_localized_content_metric_stat(NEW.owner_unit_id);
    END IF;
    RETURN NULL;
END
$$;


--
-- Name: refresh_conversation_last_message(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_conversation_last_message(p_conversation_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE latest message%ROWTYPE;
created_at_value timestamptz;
BEGIN
  SELECT * INTO latest FROM message
  WHERE conversation_id = p_conversation_id
  ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT created_at INTO created_at_value FROM conversation WHERE id = p_conversation_id;
  IF created_at_value IS NULL THEN RETURN; END IF;
  UPDATE conversation_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at, updated_at = now()
  WHERE conversation_id = p_conversation_id;
  UPDATE conversation_participant_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at,
    sort_at = coalesce(latest.created_at, created_at_value), updated_at = now()
  WHERE conversation_id = p_conversation_id;
END;
$$;


--
-- Name: refresh_unit_effective_tag(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_unit_effective_tag(target_unit_id uuid, target_tag_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  has_direct boolean;
  support_count bigint;
BEGIN
  PERFORM lock_unit_effective_tag_key(target_unit_id, target_tag_id);
  SELECT EXISTS (
    SELECT 1 FROM unit_tag
    WHERE unit_id = target_unit_id AND tag_id = target_tag_id
  ) INTO has_direct;
  SELECT count(*)
  FROM unit_tag_structure_support
  WHERE unit_id = target_unit_id AND tag_id = target_tag_id
  INTO support_count;

  IF has_direct OR support_count > 0 THEN
    INSERT INTO unit_effective_tag (
      unit_id,
      tag_id,
      direct,
      structure_support_count
    )
    VALUES (target_unit_id, target_tag_id, has_direct, support_count)
    ON CONFLICT (unit_id, tag_id) DO UPDATE SET
      direct = excluded.direct,
      structure_support_count = excluded.structure_support_count,
      updated_at = now();
  ELSE
    DELETE FROM unit_effective_tag
    WHERE unit_id = target_unit_id AND tag_id = target_tag_id;
  END IF;
END
$$;


--
-- Name: refresh_unit_effective_tag_vote(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_unit_effective_tag_vote(target_unit_id uuid, target_tag_id uuid, target_profile_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  direct_value integer;
  has_structure_support boolean;
BEGIN
  PERFORM lock_unit_effective_tag_vote_key(
    target_unit_id,
    target_tag_id,
    target_profile_id
  );
  SELECT value INTO direct_value
  FROM unit_tag_vote
  WHERE unit_id = target_unit_id
    AND tag_id = target_tag_id
    AND profile_id = target_profile_id;
  SELECT EXISTS (
    SELECT 1 FROM unit_tag_structure_support
    WHERE unit_id = target_unit_id
      AND tag_id = target_tag_id
      AND profile_id = target_profile_id
  ) INTO has_structure_support;

  IF direct_value IS NOT NULL OR has_structure_support THEN
    INSERT INTO unit_effective_tag_vote (
      unit_id,
      tag_id,
      profile_id,
      value
    )
    VALUES (
      target_unit_id,
      target_tag_id,
      target_profile_id,
      coalesce(direct_value, 1)
    )
    ON CONFLICT (unit_id, tag_id, profile_id) DO UPDATE SET
      value = excluded.value,
      updated_at = now();
  ELSE
    DELETE FROM unit_effective_tag_vote
    WHERE unit_id = target_unit_id
      AND tag_id = target_tag_id
      AND profile_id = target_profile_id;
  END IF;
END
$$;


--
-- Name: refresh_unit_structure_application_vote_stat(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_unit_structure_application_vote_stat(target_unit_id uuid, target_structure_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    target_unit_id::text || ':' || target_structure_id::text,
    71004
  ));
  INSERT INTO unit_structure_application_vote_stat (
    unit_id,
    structure_id,
    score,
    vote_count
  )
  SELECT
    target_unit_id,
    target_structure_id,
    coalesce(sum(value), 0)::bigint,
    count(*)::bigint
  FROM unit_structure_application_vote
  WHERE unit_id = target_unit_id AND structure_id = target_structure_id
  ON CONFLICT (unit_id, structure_id) DO UPDATE SET
    score = excluded.score,
    vote_count = excluded.vote_count,
    updated_at = now();
  DELETE FROM unit_structure_application_vote_stat
  WHERE unit_id = target_unit_id
    AND structure_id = target_structure_id
    AND vote_count = 0;
END
$$;


--
-- Name: refresh_unit_structure_vote_stat(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_unit_structure_vote_stat(target_structure_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    target_structure_id::text,
    71003
  ));
  INSERT INTO unit_structure_vote_stat (structure_id, score, vote_count)
  SELECT
    target_structure_id,
    coalesce(sum(value), 0)::bigint,
    count(*)::bigint
  FROM unit_structure_vote
  WHERE structure_id = target_structure_id
  ON CONFLICT (structure_id) DO UPDATE SET
    score = excluded.score,
    vote_count = excluded.vote_count,
    updated_at = now();
  DELETE FROM unit_structure_vote_stat
  WHERE structure_id = target_structure_id AND vote_count = 0;
END
$$;


--
-- Name: reject_conflicting_direct_tag_vote(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_conflicting_direct_tag_vote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM lock_unit_effective_tag_vote_key(
    NEW.unit_id,
    NEW.tag_id,
    NEW.profile_id
  );
  IF NEW.value = -1 AND EXISTS (
    SELECT 1 FROM unit_tag_structure_support
    WHERE unit_id = NEW.unit_id
      AND tag_id = NEW.tag_id
      AND profile_id = NEW.profile_id
  ) THEN
    RAISE EXCEPTION 'A negative direct Tag vote conflicts with positive structure support'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: reject_conflicting_structure_application_vote(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_conflicting_structure_application_vote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM lock_unit_structure_definition_key(NEW.structure_id);
  IF EXISTS (
    SELECT 1
    FROM unit_structure_member member
    WHERE member.structure_id = NEW.structure_id
      AND member.member_unit_id = NEW.unit_id
  ) THEN
    RAISE EXCEPTION 'A Tag hierarchy path cannot be applied to one of its members'
      USING ERRCODE = '23514';
  END IF;
  PERFORM lock_unit_effective_tag_vote_key(
    NEW.unit_id,
    member.member_unit_id,
    NEW.profile_id
  )
  FROM unit_structure_member member
  WHERE member.structure_id = NEW.structure_id
  ORDER BY member.member_unit_id;

  IF NEW.value = 1 AND EXISTS (
    SELECT 1
    FROM unit_structure_member member
    JOIN unit_tag_vote direct_vote
      ON direct_vote.unit_id = NEW.unit_id
     AND direct_vote.tag_id = member.member_unit_id
     AND direct_vote.profile_id = NEW.profile_id
     AND direct_vote.value = -1
    WHERE member.structure_id = NEW.structure_id
  ) THEN
    RAISE EXCEPTION 'Positive structure support conflicts with a negative direct Tag vote'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: reject_immutable_history_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_immutable_history_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;


--
-- Name: remove_reply_signals_before_unit_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_reply_signals_before_unit_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE relation post_reply%ROWTYPE;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    -(OLD.deleted_at IS NULL)::int,
    -(OLD.deleted_at IS NULL AND OLD.status = 'published' AND OLD.visibility = 'public'
      AND OLD.moderation_status = 'approved')::int
  );
  IF OLD.deleted_at IS NULL THEN
    PERFORM apply_unit_engagement_stat(relation.root_post_id, p_replies => -1);
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(relation.parent_post_id, p_replies => -1);
    END IF;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    relation.root_post_id, relation.created_at, 'reply', -1, -4
  );
  IF relation.parent_post_id IS NOT NULL THEN
    PERFORM apply_recommendation_unit_signal(
      relation.parent_post_id, relation.created_at, 'reply', -1, -4
    );
  END IF;
  RETURN OLD;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_enforcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_enforcement (
    id uuid DEFAULT uuidv7() NOT NULL,
    profile_id uuid NOT NULL,
    kind public.enforcement_kind NOT NULL,
    starts_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    expires_at timestamp(3) with time zone,
    decision_action_id uuid NOT NULL,
    revocation_action_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_enforcement_action_check CHECK (((revocation_action_id IS NULL) OR (revocation_action_id <> decision_action_id))),
    CONSTRAINT account_enforcement_time_check CHECK (((expires_at IS NULL) OR (expires_at > starts_at)))
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT uuidv7() NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp(3) with time zone,
    refresh_token_expires_at timestamp(3) with time zone,
    scope text,
    password text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_account_quota_binding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_account_quota_binding (
    user_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    configuration_override jsonb DEFAULT '{}'::jsonb NOT NULL,
    valid_until timestamp(3) with time zone,
    assignment_reason text NOT NULL,
    assigned_by_profile_id uuid NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    policy_subject_kind text DEFAULT 'account'::text NOT NULL,
    CONSTRAINT api_account_quota_binding_configuration_json_object_check CHECK ((jsonb_typeof(configuration_override) = 'object'::text)),
    CONSTRAINT api_account_quota_binding_policy_kind_check CHECK ((policy_subject_kind = 'account'::text)),
    CONSTRAINT api_account_quota_binding_reason_check CHECK ((btrim(assignment_reason) <> ''::text)),
    CONSTRAINT api_account_quota_binding_revision_check CHECK ((revision > 0)),
    CONSTRAINT api_account_quota_binding_validity_check CHECK (((valid_until IS NULL) OR (valid_until > created_at)))
);


--
-- Name: api_quota_daily_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_quota_daily_usage (
    id uuid DEFAULT uuidv7() NOT NULL,
    account_user_id uuid,
    token_id uuid,
    scope text NOT NULL,
    usage_date date NOT NULL,
    used_cost_units bigint NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_quota_daily_usage_scope_check CHECK (((btrim(scope) <> ''::text) AND (length(scope) <= 256))),
    CONSTRAINT api_quota_daily_usage_subject_check CHECK ((num_nonnulls(account_user_id, token_id) = 1)),
    CONSTRAINT api_quota_daily_usage_used_cost_check CHECK ((used_cost_units >= 0))
);


--
-- Name: api_quota_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_quota_policy (
    id uuid DEFAULT uuidv7() NOT NULL,
    key text NOT NULL,
    class text NOT NULL,
    current_revision integer DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    subject_kind text NOT NULL,
    CONSTRAINT api_quota_policy_class_check CHECK ((class = ANY (ARRAY['standard'::text, 'privileged'::text]))),
    CONSTRAINT api_quota_policy_current_revision_check CHECK ((current_revision > 0)),
    CONSTRAINT api_quota_policy_key_check CHECK ((key ~ '^[a-z][a-z0-9_-]{0,63}$'::text)),
    CONSTRAINT api_quota_policy_subject_kind_check CHECK ((subject_kind = ANY (ARRAY['account'::text, 'token'::text])))
);


--
-- Name: api_quota_policy_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_quota_policy_revision (
    policy_id uuid NOT NULL,
    revision integer NOT NULL,
    schema_version integer NOT NULL,
    configuration jsonb NOT NULL,
    change_reason text NOT NULL,
    created_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_quota_policy_revision_change_reason_check CHECK ((btrim(change_reason) <> ''::text)),
    CONSTRAINT api_quota_policy_revision_configuration_json_object_check CHECK ((jsonb_typeof(configuration) = 'object'::text)),
    CONSTRAINT api_quota_policy_revision_revision_check CHECK ((revision > 0)),
    CONSTRAINT api_quota_policy_revision_schema_version_check CHECK ((schema_version > 0))
);


--
-- Name: api_quota_rate_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_quota_rate_state (
    id uuid DEFAULT uuidv7() NOT NULL,
    account_user_id uuid,
    token_id uuid,
    scope text NOT NULL,
    available_rate_units bigint NOT NULL,
    refilled_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_quota_rate_state_available_units_check CHECK ((available_rate_units >= 0)),
    CONSTRAINT api_quota_rate_state_scope_check CHECK (((btrim(scope) <> ''::text) AND (length(scope) <= 256))),
    CONSTRAINT api_quota_rate_state_subject_check CHECK ((num_nonnulls(account_user_id, token_id) = 1))
);


--
-- Name: api_quota_request_lease; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_quota_request_lease (
    id uuid DEFAULT uuidv7() NOT NULL,
    request_id uuid NOT NULL,
    account_user_id uuid,
    token_id uuid,
    scope text NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_quota_request_lease_expiry_check CHECK ((expires_at > created_at)),
    CONSTRAINT api_quota_request_lease_scope_check CHECK (((btrim(scope) <> ''::text) AND (length(scope) <= 256))),
    CONSTRAINT api_quota_request_lease_subject_check CHECK ((num_nonnulls(account_user_id, token_id) = 1))
);


--
-- Name: api_token_creation_reservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_token_creation_reservation (
    id uuid DEFAULT uuidv7() NOT NULL,
    account_user_id uuid NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_token_creation_reservation_expiry_check CHECK ((expires_at > created_at))
);


--
-- Name: api_token_quota_binding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_token_quota_binding (
    token_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    policy_subject_kind text DEFAULT 'token'::text NOT NULL,
    configuration_override jsonb DEFAULT '{}'::jsonb NOT NULL,
    valid_until timestamp(3) with time zone,
    assignment_reason text NOT NULL,
    assigned_by_profile_id uuid NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_token_quota_binding_configuration_json_object_check CHECK ((jsonb_typeof(configuration_override) = 'object'::text)),
    CONSTRAINT api_token_quota_binding_policy_kind_check CHECK ((policy_subject_kind = 'token'::text)),
    CONSTRAINT api_token_quota_binding_reason_check CHECK ((btrim(assignment_reason) <> ''::text)),
    CONSTRAINT api_token_quota_binding_revision_check CHECK ((revision > 0)),
    CONSTRAINT api_token_quota_binding_validity_check CHECK (((valid_until IS NULL) OR (valid_until > created_at)))
);


--
-- Name: api_token_quota_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_token_quota_override (
    token_id uuid NOT NULL,
    configuration_override jsonb NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    updated_by_profile_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_token_quota_override_configuration_json_object_check CHECK ((jsonb_typeof(configuration_override) = 'object'::text)),
    CONSTRAINT api_token_quota_override_revision_check CHECK ((revision > 0))
);


--
-- Name: apikeys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apikeys (
    id uuid DEFAULT uuidv7() NOT NULL,
    config_id text DEFAULT 'default'::text NOT NULL,
    name text,
    start text,
    reference_id uuid NOT NULL,
    prefix text,
    key text NOT NULL,
    refill_interval integer,
    refill_amount integer,
    last_refill_at timestamp(3) with time zone,
    enabled boolean DEFAULT true,
    rate_limit_enabled boolean DEFAULT true,
    rate_limit_time_window integer DEFAULT 60000,
    rate_limit_max integer DEFAULT 300,
    request_count integer DEFAULT 0,
    remaining integer,
    last_request timestamp(3) with time zone,
    expires_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    permissions text,
    metadata text
);


--
-- Name: audio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio (
    id uuid NOT NULL,
    duration_seconds integer,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audio_duration_seconds_check CHECK (((duration_seconds IS NULL) OR (duration_seconds > 0)))
);


--
-- Name: audit_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_event (
    id uuid DEFAULT uuidv7() NOT NULL,
    actor_profile_id uuid,
    action text NOT NULL,
    reason_code text,
    request_id text,
    target_kind text,
    target_id uuid,
    target_path text,
    details jsonb,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    category public.audit_event_category NOT NULL,
    outcome public.audit_event_outcome NOT NULL,
    actor_kind public.audit_actor_kind NOT NULL,
    actor_credential_kind public.audit_credential_kind NOT NULL,
    actor_credential_id text,
    authority_kind public.audit_authority_kind NOT NULL,
    authority_id uuid,
    trace_id text,
    CONSTRAINT audit_event_action_check CHECK ((btrim(action) <> ''::text)),
    CONSTRAINT audit_event_actor_check CHECK (((actor_kind = 'profile'::public.audit_actor_kind) = (actor_profile_id IS NOT NULL))),
    CONSTRAINT audit_event_authority_check CHECK (((authority_kind = 'platform'::public.audit_authority_kind) = (authority_id IS NULL))),
    CONSTRAINT audit_event_details_json_object_check CHECK (((details IS NULL) OR (jsonb_typeof(details) = 'object'::text))),
    CONSTRAINT audit_event_schema_version_check CHECK ((schema_version = 1)),
    CONSTRAINT audit_event_target_check CHECK (((target_kind IS NOT NULL) OR ((target_id IS NULL) AND (target_path IS NULL))))
);


--
-- Name: book; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book (
    id uuid NOT NULL,
    isbn13 text,
    publication_date date,
    page_count integer,
    format text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    word_count integer,
    release_status text NOT NULL,
    CONSTRAINT book_isbn13_check CHECK (((isbn13 IS NULL) OR (isbn13 ~ '^[0-9]{13}$'::text))),
    CONSTRAINT book_page_count_check CHECK (((page_count IS NULL) OR (page_count > 0))),
    CONSTRAINT book_release_status_check CHECK ((release_status = ANY (ARRAY['ongoing'::text, 'hiatus'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT book_word_count_check CHECK (((word_count IS NULL) OR (word_count >= 0)))
);


--
-- Name: book_chapter_progress_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_chapter_progress_stat (
    profile_id uuid NOT NULL,
    book_unit_id uuid NOT NULL,
    all_completed_count bigint DEFAULT 0 NOT NULL,
    public_completed_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT book_chapter_progress_stat_count_check CHECK (((all_completed_count >= 0) AND (public_completed_count >= 0) AND (public_completed_count <= all_completed_count)))
);


--
-- Name: book_chapter_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_chapter_stat (
    book_unit_id uuid NOT NULL,
    all_count bigint DEFAULT 0 NOT NULL,
    public_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT book_chapter_stat_count_check CHECK (((all_count >= 0) AND (public_count >= 0) AND (public_count <= all_count)))
);


--
-- Name: book_localized_content_metric_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_localized_content_metric_stat (
    book_unit_id uuid NOT NULL,
    language text NOT NULL,
    chapter_count bigint DEFAULT 0 NOT NULL,
    word_count bigint DEFAULT 0 NOT NULL,
    character_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT book_localized_content_metric_stat_count_check CHECK (((chapter_count >= 0) AND (word_count >= 0) AND (character_count >= 0))),
    CONSTRAINT book_localized_content_metric_stat_language_check CHECK ((language = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text])))
);


--
-- Name: collection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection (
    id uuid NOT NULL
);


--
-- Name: collection_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_item (
    collection_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    "position" text DEFAULT 'a0'::text NOT NULL COLLATE pg_catalog."C",
    added_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_item_not_self_check CHECK ((collection_id <> unit_id))
);


--
-- Name: collection_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_stat (
    collection_id uuid NOT NULL,
    item_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_stat_count_check CHECK ((item_count >= 0))
);


--
-- Name: collection_structure_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_structure_revision (
    id uuid DEFAULT uuidv7() NOT NULL,
    collection_id uuid NOT NULL,
    parent_revision_id uuid,
    source_revision_id uuid,
    content_id uuid NOT NULL,
    actor_profile_id uuid,
    edit_summary text,
    kind text NOT NULL,
    minor boolean DEFAULT false NOT NULL,
    replay_byte_size integer NOT NULL,
    checkpoint_byte_size integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_structure_revision_checkpoint_byte_size_check CHECK ((checkpoint_byte_size >= 0)),
    CONSTRAINT collection_structure_revision_kind_check CHECK ((kind = ANY (ARRAY['create'::text, 'update'::text, 'restore'::text]))),
    CONSTRAINT collection_structure_revision_replay_byte_size_check CHECK ((replay_byte_size >= 0)),
    CONSTRAINT collection_structure_revision_source_shape_check CHECK (((kind = 'restore'::text) = (source_revision_id IS NOT NULL)))
);


--
-- Name: collection_structure_revision_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_structure_revision_head (
    collection_id uuid NOT NULL,
    revision_id uuid NOT NULL
);


--
-- Name: content_structure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_structure (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_unit_id uuid NOT NULL,
    kind text NOT NULL,
    document_key text,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_structure_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT content_structure_document_key_check CHECK (((document_key IS NULL) OR (document_key ~ '^[0-9a-f]{12}$'::text))),
    CONSTRAINT content_structure_kind_check CHECK ((kind = ANY (ARRAY['book.contents'::text, 'media.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'wiki.navigation'::text, 'zone.navigation'::text, 'page-structure'::text]))),
    CONSTRAINT content_structure_navigation_document_key_check CHECK (((kind = ANY (ARRAY['wiki.navigation'::text, 'zone.navigation'::text])) = (document_key IS NOT NULL)))
);


--
-- Name: content_structure_node; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_structure_node (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_unit_id uuid NOT NULL,
    parent_id uuid,
    content_unit_id uuid NOT NULL,
    "position" text NOT NULL COLLATE pg_catalog."C",
    content_rating public.content_rating,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    structure_id uuid NOT NULL,
    document_key text,
    target_kind text DEFAULT 'content'::text NOT NULL,
    target_unit_id uuid,
    target_url text,
    realm_tag_query_strategy text,
    CONSTRAINT content_structure_node_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT content_structure_node_document_key_check CHECK (((document_key IS NULL) OR (document_key ~ '^[0-9a-f]{12}$'::text))),
    CONSTRAINT content_structure_node_not_self_parent CHECK (((parent_id IS NULL) OR (parent_id <> id))),
    CONSTRAINT content_structure_node_realm_tag_query_strategy_check CHECK (((realm_tag_query_strategy IS NULL) OR (realm_tag_query_strategy = ANY (ARRAY['global_effective'::text, 'realm_community'::text, 'realm_policy'::text])))),
    CONSTRAINT content_structure_node_target_kind_check CHECK ((target_kind = ANY (ARRAY['content'::text, 'none'::text, 'unit'::text, 'external'::text]))),
    CONSTRAINT content_structure_node_target_shape_check CHECK ((((target_kind = ANY (ARRAY['content'::text, 'none'::text])) AND (target_unit_id IS NULL) AND (target_url IS NULL)) OR ((target_kind = 'unit'::text) AND (target_unit_id IS NOT NULL) AND (target_url IS NULL)) OR ((target_kind = 'external'::text) AND (target_unit_id IS NULL) AND (target_url ~ '^https://[^[:space:]]+$'::text) AND (char_length(target_url) <= 2000))))
);


--
-- Name: content_structure_node_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_structure_node_progress (
    profile_id uuid NOT NULL,
    node_id uuid NOT NULL,
    completed_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_structure_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_structure_revision (
    id uuid DEFAULT uuidv7() NOT NULL,
    structure_id uuid NOT NULL,
    parent_revision_id uuid,
    source_revision_id uuid,
    content_id uuid NOT NULL,
    actor_profile_id uuid,
    edit_summary text,
    kind text NOT NULL,
    minor boolean DEFAULT false NOT NULL,
    replay_byte_size integer NOT NULL,
    checkpoint_byte_size integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_structure_revision_checkpoint_byte_size_check CHECK ((checkpoint_byte_size >= 0)),
    CONSTRAINT content_structure_revision_kind_check CHECK ((kind = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'restore'::text]))),
    CONSTRAINT content_structure_revision_replay_byte_size_check CHECK ((replay_byte_size >= 0)),
    CONSTRAINT content_structure_revision_source_shape_check CHECK (((kind = 'restore'::text) = (source_revision_id IS NOT NULL)))
);


--
-- Name: content_structure_revision_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_structure_revision_head (
    structure_id uuid NOT NULL,
    revision_id uuid NOT NULL
);


--
-- Name: conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation (
    id uuid DEFAULT uuidv7() NOT NULL,
    participant_low_profile_id uuid NOT NULL,
    participant_high_profile_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_participant_order_check CHECK ((participant_low_profile_id < participant_high_profile_id))
);


--
-- Name: conversation_participant_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participant_stat (
    conversation_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    last_message_id uuid,
    last_message_at timestamp(3) with time zone,
    sort_at timestamp(3) with time zone NOT NULL,
    unread_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_participant_stat_count_check CHECK ((unread_count >= 0))
);


--
-- Name: conversation_read; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_read (
    conversation_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    last_read_message_id uuid,
    read_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_stat (
    conversation_id uuid NOT NULL,
    last_message_id uuid,
    last_message_at timestamp(3) with time zone,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_attribution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_attribution (
    id uuid DEFAULT uuidv7() NOT NULL,
    source_unit_id uuid CONSTRAINT credit_attribution_unit_id_not_null NOT NULL,
    credited_unit_id uuid CONSTRAINT credit_attribution_entity_id_not_null NOT NULL,
    role text NOT NULL,
    "position" text DEFAULT 'a0'::text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_attribution_not_self_check CHECK ((source_unit_id <> credited_unit_id)),
    CONSTRAINT credit_attribution_role_check CHECK ((role = ANY (ARRAY['author'::text, 'co-author'::text, 'translator'::text, 'illustrator'::text, 'editor'::text, 'publisher'::text, 'letterer'::text, 'colorist'::text, 'developer'::text, 'composer'::text, 'designer'::text, 'director'::text, 'producer'::text, 'writer'::text, 'actor'::text, 'narrator'::text, 'studio'::text, 'distributor'::text])))
);


--
-- Name: dock_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dock_revision (
    id uuid DEFAULT uuidv7() NOT NULL,
    dock_id uuid NOT NULL,
    parent_revision_id uuid,
    source_revision_id uuid,
    content_id uuid NOT NULL,
    actor_profile_id uuid,
    edit_summary text,
    kind text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dock_revision_kind_check CHECK ((kind = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'restore'::text]))),
    CONSTRAINT dock_revision_source_shape_check CHECK (((kind = 'restore'::text) = (source_revision_id IS NOT NULL)))
);


--
-- Name: dock_revision_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dock_revision_head (
    dock_id uuid NOT NULL,
    revision_id uuid NOT NULL
);


--
-- Name: email_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_outbox (
    id uuid DEFAULT uuidv7() NOT NULL,
    kind public.email_outbox_kind NOT NULL,
    notification_id uuid,
    recipient_email text,
    locale text,
    action_url text,
    status public.email_outbox_status DEFAULT 'pending'::public.email_outbox_status NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    available_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    lease_expires_at timestamp(3) with time zone,
    accepted_at timestamp(3) with time zone,
    failed_at timestamp(3) with time zone,
    provider_message_id text,
    provider_status public.email_provider_status,
    last_error text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_outbox_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT email_outbox_intent_check CHECK ((((kind = 'notification'::public.email_outbox_kind) AND (notification_id IS NOT NULL) AND (recipient_email IS NULL) AND (locale IS NULL) AND (action_url IS NULL)) OR ((kind = ANY (ARRAY['verify_email'::public.email_outbox_kind, 'reset_password'::public.email_outbox_kind])) AND (notification_id IS NULL) AND (((status = ANY (ARRAY['pending'::public.email_outbox_status, 'processing'::public.email_outbox_status])) AND (NULLIF(btrim(recipient_email), ''::text) IS NOT NULL) AND (NULLIF(btrim(action_url), ''::text) IS NOT NULL) AND (locale = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]))) OR ((status = ANY (ARRAY['accepted'::public.email_outbox_status, 'failed'::public.email_outbox_status])) AND (recipient_email IS NULL) AND (locale IS NULL) AND (action_url IS NULL)))))),
    CONSTRAINT email_outbox_state_check CHECK ((((status = 'pending'::public.email_outbox_status) AND (lease_expires_at IS NULL) AND (accepted_at IS NULL) AND (failed_at IS NULL) AND (provider_message_id IS NULL) AND (provider_status IS NULL)) OR ((status = 'processing'::public.email_outbox_status) AND (lease_expires_at IS NOT NULL) AND (accepted_at IS NULL) AND (failed_at IS NULL) AND (provider_message_id IS NULL) AND (provider_status IS NULL) AND (last_error IS NULL)) OR ((status = 'accepted'::public.email_outbox_status) AND (lease_expires_at IS NULL) AND (accepted_at IS NOT NULL) AND (failed_at IS NULL) AND (provider_status IS NOT NULL) AND ((provider_status = 'logged'::public.email_provider_status) OR (NULLIF(btrim(provider_message_id), ''::text) IS NOT NULL)) AND (last_error IS NULL)) OR ((status = 'failed'::public.email_outbox_status) AND (lease_expires_at IS NULL) AND (accepted_at IS NULL) AND (failed_at IS NOT NULL) AND (provider_message_id IS NULL) AND (provider_status IS NULL) AND (NULLIF(btrim(last_error), ''::text) IS NOT NULL))))
);


--
-- Name: entity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity (
    id uuid NOT NULL,
    kind text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entity_kind_not_blank CHECK ((btrim(kind) <> ''::text))
);


--
-- Name: governance_post_binding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_post_binding (
    post_id uuid NOT NULL,
    subject_kind public.governance_note_subject_kind NOT NULL,
    subject_id uuid NOT NULL,
    role public.governance_note_role NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: image_asset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_asset (
    id uuid DEFAULT uuidv7() NOT NULL,
    uploader_profile_id uuid NOT NULL,
    owner_profile_id uuid NOT NULL,
    status public.image_asset_status DEFAULT 'pending'::public.image_asset_status NOT NULL,
    access public.image_asset_access DEFAULT 'private'::public.image_asset_access NOT NULL,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT image_asset_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at)))
);


--
-- Name: image_asset_presentation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_asset_presentation (
    asset_id uuid NOT NULL,
    role public.image_asset_presentation_role NOT NULL,
    fit public.image_asset_presentation_fit NOT NULL,
    crop_x double precision,
    crop_y double precision,
    crop_width double precision,
    crop_height double precision,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT image_asset_presentation_crop_bounds_check CHECK (((fit <> 'crop'::public.image_asset_presentation_fit) OR ((crop_x >= (0)::double precision) AND (crop_y >= (0)::double precision) AND (crop_width > (0)::double precision) AND (crop_height > (0)::double precision) AND ((crop_x + crop_width) <= (1)::double precision) AND ((crop_y + crop_height) <= (1)::double precision)))),
    CONSTRAINT image_asset_presentation_revision_check CHECK ((revision > 0)),
    CONSTRAINT image_asset_presentation_shape_check CHECK ((((role = 'cover'::public.image_asset_presentation_role) AND (fit = 'contain'::public.image_asset_presentation_fit) AND (crop_x IS NULL) AND (crop_y IS NULL) AND (crop_width IS NULL) AND (crop_height IS NULL)) OR ((fit = 'crop'::public.image_asset_presentation_fit) AND (crop_x IS NOT NULL) AND (crop_y IS NOT NULL) AND (crop_width IS NOT NULL) AND (crop_height IS NOT NULL))))
);


--
-- Name: image_object; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_object (
    id uuid DEFAULT uuidv7() NOT NULL,
    asset_id uuid NOT NULL,
    storage_key text NOT NULL,
    media_type text,
    byte_size bigint,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    width integer,
    height integer,
    CONSTRAINT image_object_metadata_shape_check CHECK ((((media_type IS NULL) AND (byte_size IS NULL) AND (width IS NULL) AND (height IS NULL)) OR ((media_type IS NOT NULL) AND (byte_size > 0) AND (width > 0) AND (height > 0)))),
    CONSTRAINT image_object_storage_key_not_blank CHECK ((btrim(storage_key) <> ''::text))
);


--
-- Name: label; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.label (
    id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id uuid NOT NULL,
    kind text NOT NULL,
    release_date date,
    runtime_minutes integer,
    episode_count integer,
    season_count integer,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    release_status text NOT NULL,
    CONSTRAINT media_episode_count_check CHECK (((episode_count IS NULL) OR (episode_count > 0))),
    CONSTRAINT media_kind_not_blank CHECK ((btrim(kind) <> ''::text)),
    CONSTRAINT media_release_status_check CHECK ((release_status = ANY (ARRAY['ongoing'::text, 'hiatus'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT media_runtime_check CHECK (((runtime_minutes IS NULL) OR (runtime_minutes > 0))),
    CONSTRAINT media_season_count_check CHECK (((season_count IS NULL) OR (season_count > 0)))
);


--
-- Name: message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message (
    id uuid DEFAULT uuidv7() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_profile_id uuid NOT NULL,
    content text,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_content_state_check CHECK ((((deleted_at IS NULL) AND (NULLIF(btrim(content), ''::text) IS NOT NULL)) OR ((deleted_at IS NOT NULL) AND (content IS NULL)))),
    CONSTRAINT message_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at)))
);


--
-- Name: moderation_action; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_action (
    id uuid DEFAULT uuidv7() NOT NULL,
    case_id uuid NOT NULL,
    actor_profile_id uuid NOT NULL,
    kind public.moderation_action_kind NOT NULL,
    resulting_status public.moderation_status,
    reason_code public.governance_reason_code NOT NULL,
    reverses_action_id uuid,
    request_id text,
    idempotency_key text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    previous_state text,
    resulting_state text,
    request_fingerprint text,
    resulting_post_targeting_locked boolean,
    previous_post_targeting_locked boolean,
    content_license_id uuid,
    previous_content_license_status public.unit_content_license_status,
    resulting_content_license_status public.unit_content_license_status,
    CONSTRAINT moderation_action_content_license_transition_check CHECK ((((kind = 'invalidate_content_license'::public.moderation_action_kind) AND (content_license_id IS NOT NULL) AND (previous_content_license_status = 'active'::public.unit_content_license_status) AND (resulting_content_license_status = 'invalidated'::public.unit_content_license_status)) OR ((kind = 'restore_content_license'::public.moderation_action_kind) AND (content_license_id IS NOT NULL) AND (previous_content_license_status = 'invalidated'::public.unit_content_license_status) AND (resulting_content_license_status = 'active'::public.unit_content_license_status)) OR ((kind <> ALL (ARRAY['invalidate_content_license'::public.moderation_action_kind, 'restore_content_license'::public.moderation_action_kind])) AND (content_license_id IS NULL) AND (previous_content_license_status IS NULL) AND (resulting_content_license_status IS NULL)))),
    CONSTRAINT moderation_action_not_self_reverse CHECK (((reverses_action_id IS NULL) OR (reverses_action_id <> id))),
    CONSTRAINT moderation_action_post_targeting_lock_outcome_check CHECK (((previous_post_targeting_locked IS NULL) = (resulting_post_targeting_locked IS NULL))),
    CONSTRAINT moderation_action_request_fingerprint_check CHECK (((request_fingerprint IS NULL) OR (request_fingerprint ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT moderation_action_reversal_check CHECK (((kind = ANY (ARRAY['reverse'::public.moderation_action_kind, 'revoke_enforcement'::public.moderation_action_kind, 'restore_content_license'::public.moderation_action_kind])) = (reverses_action_id IS NOT NULL))),
    CONSTRAINT moderation_action_single_outcome_check CHECK ((num_nonnulls(previous_state, previous_post_targeting_locked, previous_content_license_status) <= 1)),
    CONSTRAINT moderation_action_state_outcome_check CHECK (((previous_state IS NULL) = (resulting_state IS NULL)))
);


--
-- Name: moderation_case; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_case (
    id uuid DEFAULT uuidv7() NOT NULL,
    state public.moderation_case_state DEFAULT 'new'::public.moderation_case_state NOT NULL,
    authority public.moderation_authority DEFAULT 'platform'::public.moderation_authority NOT NULL,
    realm_id uuid,
    target_kind public.moderation_target_kind NOT NULL,
    target_id uuid NOT NULL,
    target_path text,
    assigned_profile_id uuid,
    duplicate_of_case_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT moderation_case_authority_check CHECK (((authority = 'realm'::public.moderation_authority) = (realm_id IS NOT NULL))),
    CONSTRAINT moderation_case_duplicate_state_check CHECK (((state = 'duplicate'::public.moderation_case_state) = (duplicate_of_case_id IS NOT NULL))),
    CONSTRAINT moderation_case_not_self_duplicate CHECK (((duplicate_of_case_id IS NULL) OR (duplicate_of_case_id <> id))),
    CONSTRAINT moderation_case_path_check CHECK (((target_kind = 'unit_field'::public.moderation_target_kind) = (NULLIF(btrim(target_path), ''::text) IS NOT NULL)))
);


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id uuid DEFAULT uuidv7() NOT NULL,
    recipient_profile_id uuid NOT NULL,
    actor_profile_id uuid,
    kind public.notification_kind NOT NULL,
    subject_unit_id uuid,
    payload jsonb,
    dedupe_key text,
    in_app_visible boolean DEFAULT true NOT NULL,
    read_at timestamp(3) with time zone,
    email_status public.notification_email_status DEFAULT 'not_requested'::public.notification_email_status NOT NULL,
    emailed_at timestamp(3) with time zone,
    email_error text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_email_state_check CHECK ((((email_status = 'sent'::public.notification_email_status) AND (emailed_at IS NOT NULL) AND (email_error IS NULL)) OR ((email_status = 'failed'::public.notification_email_status) AND (emailed_at IS NULL) AND (NULLIF(btrim(email_error), ''::text) IS NOT NULL)) OR ((email_status = ANY (ARRAY['not_requested'::public.notification_email_status, 'pending'::public.notification_email_status])) AND (emailed_at IS NULL) AND (email_error IS NULL)))),
    CONSTRAINT notification_not_self_check CHECK (((actor_profile_id IS NULL) OR (actor_profile_id <> recipient_profile_id))),
    CONSTRAINT notification_payload_json_object_check CHECK (((payload IS NULL) OR (jsonb_typeof(payload) = 'object'::text))),
    CONSTRAINT notification_read_at_check CHECK (((read_at IS NULL) OR (read_at >= created_at)))
);


--
-- Name: notification_preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preference (
    profile_id uuid NOT NULL,
    kind public.notification_kind NOT NULL,
    in_app boolean DEFAULT true NOT NULL,
    email boolean DEFAULT true NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_recipient_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_recipient_stat (
    profile_id uuid NOT NULL,
    unread_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_recipient_stat_count_check CHECK ((unread_count >= 0))
);


--
-- Name: platform_capability_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_capability_grant (
    id uuid DEFAULT uuidv7() CONSTRAINT capability_grant_id_not_null NOT NULL,
    profile_id uuid CONSTRAINT capability_grant_profile_id_not_null NOT NULL,
    capability public.platform_capability CONSTRAINT capability_grant_capability_not_null NOT NULL,
    granted_by_profile_id uuid CONSTRAINT capability_grant_granted_by_profile_id_not_null NOT NULL,
    expires_at timestamp(3) with time zone,
    revoked_at timestamp(3) with time zone,
    revoked_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() CONSTRAINT capability_grant_created_at_not_null NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() CONSTRAINT capability_grant_updated_at_not_null NOT NULL,
    CONSTRAINT platform_capability_grant_current_capability_check CHECK ((capability <> 'unit.ownership.transfer'::public.platform_capability)),
    CONSTRAINT platform_capability_grant_expiry_check CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT platform_capability_grant_revocation_check CHECK (((revoked_at IS NULL) = (revoked_by_profile_id IS NULL)))
);


--
-- Name: platform_unit_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_unit_report (
    id uuid DEFAULT uuidv7() NOT NULL,
    case_id uuid NOT NULL,
    reporter_profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    rule_source_realm_id uuid NOT NULL,
    rule_revision_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    details text,
    reported_revision_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_unit_report_details_length CHECK (((details IS NULL) OR (char_length(details) <= 2000))),
    CONSTRAINT platform_unit_report_details_not_blank CHECK (((details IS NULL) OR (btrim(details) <> ''::text))),
    CONSTRAINT platform_unit_report_rule_source_check CHECK ((rule_source_realm_id = '019b76da-a800-7300-8000-000000000003'::uuid))
);


--
-- Name: poll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll (
    id uuid NOT NULL,
    mode public.poll_mode DEFAULT 'single'::public.poll_mode NOT NULL,
    result_visibility public.poll_result_visibility DEFAULT 'live'::public.poll_result_visibility NOT NULL,
    anonymous boolean DEFAULT false NOT NULL,
    closes_at timestamp(3) with time zone,
    closed_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT poll_closed_at_check CHECK (((closed_at IS NULL) OR (closed_at >= created_at))),
    CONSTRAINT poll_closes_at_check CHECK (((closes_at IS NULL) OR (closes_at > created_at)))
);


--
-- Name: poll_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_option (
    id uuid DEFAULT uuidv7() NOT NULL,
    poll_id uuid NOT NULL,
    "position" integer NOT NULL,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    source_kind public.poll_option_source_kind DEFAULT 'literal'::public.poll_option_source_kind NOT NULL,
    target_unit_id uuid,
    CONSTRAINT poll_option_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT poll_option_source_check CHECK ((((source_kind = 'literal'::public.poll_option_source_kind) AND (target_unit_id IS NULL)) OR ((source_kind = 'unit'::public.poll_option_source_kind) AND (target_unit_id IS NOT NULL))))
);


--
-- Name: poll_option_vote_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_option_vote_stat (
    option_id uuid NOT NULL,
    vote_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT poll_option_vote_stat_count_check CHECK ((vote_count >= 0))
);


--
-- Name: poll_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poll_vote (
    poll_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    option_id uuid NOT NULL,
    realm_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: post; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post (
    id uuid NOT NULL,
    subject_unit_id uuid,
    kind public.post_kind DEFAULT 'post'::public.post_kind NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT post_excerpt_subject_check CHECK (((kind <> 'excerpt'::public.post_kind) OR (subject_unit_id IS NOT NULL))),
    CONSTRAINT post_review_subject_check CHECK (((kind <> 'review'::public.post_kind) OR (subject_unit_id IS NOT NULL))),
    CONSTRAINT post_subject_not_self_check CHECK (((subject_unit_id IS NULL) OR (subject_unit_id <> id)))
);


--
-- Name: post_progress_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_progress_entry (
    post_id uuid NOT NULL,
    progress_entry_id uuid NOT NULL,
    "position" text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: post_reply; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_reply (
    post_id uuid NOT NULL,
    root_post_id uuid NOT NULL,
    parent_post_id uuid,
    depth integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT post_reply_depth_check CHECK (((depth >= 0) AND (depth <= 64))),
    CONSTRAINT post_reply_not_root_check CHECK ((post_id <> root_post_id)),
    CONSTRAINT post_reply_not_self_parent_check CHECK (((parent_post_id IS NULL) OR (parent_post_id <> post_id)))
);


--
-- Name: post_reply_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_reply_stat (
    post_id uuid NOT NULL,
    undeleted_direct_count bigint DEFAULT 0 NOT NULL,
    undeleted_descendant_count bigint DEFAULT 0 NOT NULL,
    visible_direct_count bigint DEFAULT 0 NOT NULL,
    visible_descendant_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT post_reply_stat_count_check CHECK (((undeleted_direct_count >= 0) AND (undeleted_descendant_count >= 0) AND (visible_direct_count >= 0) AND (visible_descendant_count >= 0)))
);


--
-- Name: post_score; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_score (
    post_id uuid NOT NULL,
    score_id uuid NOT NULL,
    "position" text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile (
    id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    joined_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile_block; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_block (
    blocker_profile_id uuid NOT NULL,
    blocked_profile_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_block_not_self_check CHECK ((blocker_profile_id <> blocked_profile_id))
);


--
-- Name: profile_favorites_collection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_favorites_collection (
    profile_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile_preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_preference (
    profile_id uuid NOT NULL,
    default_license text,
    default_realm_manage_mode boolean DEFAULT false NOT NULL,
    personalized_feed boolean DEFAULT true NOT NULL,
    collection_config jsonb,
    content_ratings public.content_rating[] DEFAULT ARRAY['general'::public.content_rating, 'r15'::public.content_rating] NOT NULL,
    preferred_languages text[] DEFAULT ARRAY['en'::text] NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    interface_locale text DEFAULT 'zh-Hant'::text NOT NULL,
    default_score_realm_id uuid,
    filter_feed_by_preferred_languages boolean DEFAULT false NOT NULL,
    chinese_content_display text DEFAULT 'original'::text NOT NULL,
    score_visibility public.resource_visibility DEFAULT 'public'::public.resource_visibility NOT NULL,
    progress_visibility public.resource_visibility DEFAULT 'public'::public.resource_visibility NOT NULL,
    CONSTRAINT profile_preference_chinese_content_display_check CHECK ((chinese_content_display = ANY (ARRAY['original'::text, 'hant'::text, 'hans'::text]))),
    CONSTRAINT profile_preference_collection_config_json_object_check CHECK (((collection_config IS NULL) OR (jsonb_typeof(collection_config) = 'object'::text))),
    CONSTRAINT profile_preference_content_ratings_check CHECK ((cardinality(content_ratings) > 0)),
    CONSTRAINT profile_preference_default_license_check CHECK (((default_license IS NULL) OR (btrim(default_license) <> ''::text))),
    CONSTRAINT profile_preference_interface_locale_check CHECK ((interface_locale = ANY (ARRAY['en'::text, 'zh-Hant'::text, 'zh-Hans'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]))),
    CONSTRAINT profile_preference_languages_check CHECK (((cardinality(preferred_languages) > 0) AND (preferred_languages <@ ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]) AND (cardinality(array_positions(preferred_languages, 'zh'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'en'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'ja'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'ko'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'de'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'fr'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'es'::text)) <= 1)))
);


--
-- Name: profile_realm_tag_subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_realm_tag_subscription (
    profile_id uuid NOT NULL,
    realm_id uuid NOT NULL,
    "position" text DEFAULT (('a0'::text || replace((uuidv7())::text, '-'::text, ''::text)) || 'V'::text) NOT NULL COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: profile_unit_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_unit_tag (
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    "position" text DEFAULT 'a0'::text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_unit_tag_not_self_check CHECK ((unit_id <> tag_id))
);


--
-- Name: realm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm (
    id uuid NOT NULL,
    join_policy public.realm_join_policy DEFAULT 'open'::public.realm_join_policy NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    enabled_pages public.realm_page_kind[] DEFAULT ARRAY['main'::public.realm_page_kind] NOT NULL,
    realm_tag_voting_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT realm_enabled_pages_cardinality_check CHECK (((cardinality(enabled_pages) >= 1) AND (cardinality(enabled_pages) <= 3))),
    CONSTRAINT realm_enabled_pages_main_check CHECK ((cardinality(array_positions(enabled_pages, 'main'::public.realm_page_kind)) = 1)),
    CONSTRAINT realm_enabled_pages_no_null_check CHECK ((array_position(enabled_pages, NULL::public.realm_page_kind) IS NULL)),
    CONSTRAINT realm_enabled_pages_tags_unique_check CHECK ((cardinality(array_positions(enabled_pages, 'tags'::public.realm_page_kind)) <= 1)),
    CONSTRAINT realm_enabled_pages_wiki_unique_check CHECK ((cardinality(array_positions(enabled_pages, 'wiki'::public.realm_page_kind)) <= 1))
);


--
-- Name: realm_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_member (
    realm_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    state public.realm_member_state DEFAULT 'active'::public.realm_member_state NOT NULL,
    joined_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: realm_pin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_pin (
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    kind public.realm_pin_kind DEFAULT 'pinned'::public.realm_pin_kind NOT NULL,
    "position" text DEFAULT 'a0'::text NOT NULL COLLATE pg_catalog."C",
    created_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_pin_not_self_check CHECK ((realm_id <> unit_id))
);


--
-- Name: realm_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_rule (
    id uuid NOT NULL,
    revision_id uuid NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: realm_rule_acceptance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_rule_acceptance (
    revision_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    language text,
    accepted_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_rule_acceptance_language_check CHECK (((language IS NULL) OR (language = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]))))
);


--
-- Name: realm_rule_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_rule_revision (
    id uuid DEFAULT uuidv7() CONSTRAINT realm_rule_revision_id_not_null1 NOT NULL,
    realm_id uuid NOT NULL,
    version integer NOT NULL,
    require_on_join boolean DEFAULT false NOT NULL,
    require_on_post boolean DEFAULT false NOT NULL,
    created_by_profile_id uuid,
    published_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    acknowledgement_mode public.realm_rule_acknowledgement_mode DEFAULT 'explicit'::public.realm_rule_acknowledgement_mode NOT NULL,
    CONSTRAINT realm_rule_revision_version_check CHECK ((version > 0))
);


--
-- Name: realm_score_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_score_context (
    realm_id uuid NOT NULL,
    context_post_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: realm_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_stat (
    realm_id uuid NOT NULL,
    active_member_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_stat_count_check CHECK ((active_member_count >= 0))
);


--
-- Name: realm_tag_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_tag_context (
    realm_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    context_post_id uuid NOT NULL,
    created_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: realm_tag_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_tag_vote (
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_tag_vote_not_self_check CHECK ((unit_id <> tag_id)),
    CONSTRAINT realm_tag_vote_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: realm_tag_vote_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_tag_vote_stat (
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    score bigint DEFAULT 0 NOT NULL,
    vote_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_tag_vote_stat_count_check CHECK ((vote_count >= 0)),
    CONSTRAINT realm_tag_vote_stat_score_check CHECK ((abs(score) <= vote_count))
);


--
-- Name: realm_unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_unit (
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    status public.realm_unit_status DEFAULT 'visible'::public.realm_unit_status NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    post_targeting_locked boolean DEFAULT false NOT NULL,
    publication_state public.realm_unit_publication_state DEFAULT 'active'::public.realm_unit_publication_state NOT NULL,
    CONSTRAINT realm_unit_not_self_check CHECK ((realm_id <> unit_id))
);


--
-- Name: realm_unit_moderation_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_unit_moderation_stat (
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    open_report_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_unit_moderation_stat_count_check CHECK ((open_report_count >= 0))
);


--
-- Name: realm_unit_publication_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_unit_publication_event (
    id uuid DEFAULT uuidv7() NOT NULL,
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    from_state public.realm_unit_publication_state,
    to_state public.realm_unit_publication_state NOT NULL,
    changed_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_unit_publication_event_transition_check CHECK (((from_state IS NULL) OR (from_state <> to_state)))
);


--
-- Name: realm_unit_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_unit_report (
    id uuid DEFAULT uuidv7() NOT NULL,
    case_id uuid NOT NULL,
    reporter_profile_id uuid NOT NULL,
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    rule_revision_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    details text,
    reported_revision_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_unit_report_details_length CHECK (((details IS NULL) OR (char_length(details) <= 2000))),
    CONSTRAINT realm_unit_report_details_not_blank CHECK (((details IS NULL) OR (btrim(details) <> ''::text)))
);


--
-- Name: realm_unit_status_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_unit_status_event (
    id uuid DEFAULT uuidv7() NOT NULL,
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    from_status public.realm_unit_status,
    to_status public.realm_unit_status NOT NULL,
    changed_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    moderation_action_id uuid,
    CONSTRAINT realm_unit_status_event_transition_check CHECK (((from_status IS NULL) OR (from_status <> to_status)))
);


--
-- Name: realm_unit_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realm_unit_tag (
    realm_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    "position" text DEFAULT 'a0'::text NOT NULL COLLATE pg_catalog."C",
    created_by_profile_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT realm_unit_tag_not_self_check CHECK ((unit_id <> tag_id))
);


--
-- Name: recommendation_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_event (
    id uuid DEFAULT uuidv7() NOT NULL,
    profile_id uuid,
    request_id uuid NOT NULL,
    surface public.recommendation_surface NOT NULL,
    type public.recommendation_event_type NOT NULL,
    target_unit_id uuid NOT NULL,
    "position" integer NOT NULL,
    policy_version text NOT NULL,
    occurred_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_event_policy_version_not_blank CHECK ((btrim(policy_version) <> ''::text)),
    CONSTRAINT recommendation_event_position_check CHECK ((("position" >= 0) AND ("position" <= 999)))
);


--
-- Name: recommendation_exclusion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_exclusion (
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: recommendation_metric_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_metric_daily (
    day date NOT NULL,
    surface public.recommendation_surface NOT NULL,
    policy_version text NOT NULL,
    impressions bigint DEFAULT 0 NOT NULL,
    opens bigint DEFAULT 0 NOT NULL,
    dwell_30s bigint DEFAULT 0 NOT NULL,
    not_interested bigint DEFAULT 0 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_metric_daily_counts_check CHECK (((impressions >= 0) AND (opens >= 0) AND (dwell_30s >= 0) AND (not_interested >= 0))),
    CONSTRAINT recommendation_metric_daily_policy_version_not_blank CHECK ((btrim(policy_version) <> ''::text))
);


--
-- Name: recommendation_profile_interest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_profile_interest (
    snapshot_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    weight double precision NOT NULL,
    rank integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_profile_interest_value_check CHECK (((weight > (0)::double precision) AND ((rank >= 1) AND (rank <= 50))))
);


--
-- Name: recommendation_profile_signal_hourly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_profile_signal_hourly (
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    bucket_start timestamp(3) with time zone NOT NULL,
    kind public.recommendation_signal_kind NOT NULL,
    signal_count bigint DEFAULT 0 NOT NULL,
    weight double precision DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_profile_signal_hourly_count_check CHECK ((signal_count >= 0))
);


--
-- Name: recommendation_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_snapshot (
    id uuid DEFAULT uuidv7() NOT NULL,
    policy_version text NOT NULL,
    state public.recommendation_snapshot_state DEFAULT 'building'::public.recommendation_snapshot_state NOT NULL,
    active boolean DEFAULT false NOT NULL,
    source_watermark timestamp(3) with time zone,
    started_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    completed_at timestamp(3) with time zone,
    error text,
    CONSTRAINT recommendation_snapshot_active_ready_check CHECK (((NOT active) OR ((state = 'ready'::public.recommendation_snapshot_state) AND (completed_at IS NOT NULL)))),
    CONSTRAINT recommendation_snapshot_completion_check CHECK ((((state = 'building'::public.recommendation_snapshot_state) AND (completed_at IS NULL)) OR ((state <> 'building'::public.recommendation_snapshot_state) AND (completed_at IS NOT NULL)))),
    CONSTRAINT recommendation_snapshot_policy_version_not_blank CHECK ((btrim(policy_version) <> ''::text))
);


--
-- Name: recommendation_unit_edge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_unit_edge (
    snapshot_id uuid NOT NULL,
    source_unit_id uuid NOT NULL,
    target_unit_id uuid NOT NULL,
    structural_score double precision DEFAULT 0 NOT NULL,
    behavioral_score double precision DEFAULT 0 NOT NULL,
    score double precision NOT NULL,
    rank integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_unit_edge_not_self_check CHECK ((source_unit_id <> target_unit_id)),
    CONSTRAINT recommendation_unit_edge_score_check CHECK (((structural_score >= (0)::double precision) AND (behavioral_score >= (0)::double precision) AND (score > (0)::double precision) AND ((rank >= 1) AND (rank <= 100))))
);


--
-- Name: recommendation_unit_signal_hourly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_unit_signal_hourly (
    unit_id uuid NOT NULL,
    bucket_start timestamp(3) with time zone NOT NULL,
    kind public.recommendation_signal_kind NOT NULL,
    signal_count bigint DEFAULT 0 NOT NULL,
    weight double precision DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recommendation_unit_signal_hourly_count_check CHECK ((signal_count >= 0)),
    CONSTRAINT recommendation_unit_signal_hourly_weight_check CHECK ((weight >= (0)::double precision))
);


--
-- Name: recommendation_unit_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendation_unit_stat (
    id uuid DEFAULT uuidv7() NOT NULL,
    snapshot_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    context_realm_id uuid,
    impressions bigint DEFAULT 0 NOT NULL,
    opens bigint DEFAULT 0 NOT NULL,
    dwell_30s bigint DEFAULT 0 NOT NULL,
    upvotes bigint DEFAULT 0 NOT NULL,
    downvotes bigint DEFAULT 0 NOT NULL,
    replies bigint DEFAULT 0 NOT NULL,
    favorites bigint DEFAULT 0 NOT NULL,
    shares bigint DEFAULT 0 NOT NULL,
    high_scores bigint DEFAULT 0 NOT NULL,
    active_progress bigint DEFAULT 0 NOT NULL,
    completions bigint DEFAULT 0 NOT NULL,
    negative_progress bigint DEFAULT 0 NOT NULL,
    engagement_6h double precision DEFAULT 0 NOT NULL,
    engagement_24h double precision DEFAULT 0 NOT NULL,
    engagement_7d double precision DEFAULT 0 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    unit_created_at timestamp(3) with time zone NOT NULL,
    best_score double precision NOT NULL,
    hot_score double precision NOT NULL,
    top_score double precision NOT NULL,
    rising_score double precision NOT NULL,
    CONSTRAINT recommendation_unit_stat_counts_check CHECK (((impressions >= 0) AND (opens >= 0) AND (dwell_30s >= 0) AND (upvotes >= 0) AND (downvotes >= 0) AND (replies >= 0) AND (favorites >= 0) AND (shares >= 0) AND (high_scores >= 0) AND (active_progress >= 0) AND (completions >= 0) AND (negative_progress >= 0))),
    CONSTRAINT recommendation_unit_stat_engagement_check CHECK (((engagement_6h >= (0)::double precision) AND (engagement_24h >= (0)::double precision) AND (engagement_7d >= (0)::double precision))),
    CONSTRAINT recommendation_unit_stat_objective_score_check CHECK (((best_score >= (0)::double precision) AND (hot_score >= (0)::double precision) AND (top_score >= (0)::double precision) AND (rising_score >= (0)::double precision)))
);


--
-- Name: release; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release (
    id uuid NOT NULL,
    parent_unit_id uuid NOT NULL,
    version_label text NOT NULL,
    released_on date,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT release_not_self_check CHECK ((id <> parent_unit_id)),
    CONSTRAINT release_version_label_not_blank CHECK ((btrim(version_label) <> ''::text))
);


--
-- Name: revision_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revision_content (
    id uuid DEFAULT uuidv7() NOT NULL,
    model text NOT NULL,
    sha256 text NOT NULL,
    byte_size integer NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    encoding text DEFAULT 'full'::text NOT NULL,
    base_content_id uuid,
    delta_depth integer DEFAULT 0 NOT NULL,
    CONSTRAINT revision_content_byte_size_check CHECK ((byte_size >= 0)),
    CONSTRAINT revision_content_delta_shape_check CHECK ((((encoding = 'full'::text) AND (base_content_id IS NULL) AND (delta_depth = 0)) OR ((encoding = 'delta'::text) AND (base_content_id IS NOT NULL) AND (delta_depth > 0)))),
    CONSTRAINT revision_content_encoding_check CHECK ((encoding = ANY (ARRAY['full'::text, 'delta'::text]))),
    CONSTRAINT revision_content_model_not_blank CHECK ((btrim(model) <> ''::text)),
    CONSTRAINT revision_content_payload_check CHECK ((jsonb_typeof(payload) = ANY (ARRAY['object'::text, 'array'::text]))),
    CONSTRAINT revision_content_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: score; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.score (
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    realm_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    visibility public.resource_visibility DEFAULT 'public'::public.resource_visibility NOT NULL,
    CONSTRAINT score_value_check CHECK (((value >= 1) AND (value <= 10)))
);


--
-- Name: score_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.score_stat (
    unit_id uuid NOT NULL,
    realm_id uuid NOT NULL,
    total_count bigint DEFAULT 0 NOT NULL,
    total_score bigint DEFAULT 0 NOT NULL,
    score_1_count bigint DEFAULT 0 NOT NULL,
    score_2_count bigint DEFAULT 0 NOT NULL,
    score_3_count bigint DEFAULT 0 NOT NULL,
    score_4_count bigint DEFAULT 0 NOT NULL,
    score_5_count bigint DEFAULT 0 NOT NULL,
    score_6_count bigint DEFAULT 0 NOT NULL,
    score_7_count bigint DEFAULT 0 NOT NULL,
    score_8_count bigint DEFAULT 0 NOT NULL,
    score_9_count bigint DEFAULT 0 NOT NULL,
    score_10_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT score_stat_nonnegative_check CHECK (((total_count >= 0) AND (total_score >= 0) AND (score_1_count >= 0) AND (score_2_count >= 0) AND (score_3_count >= 0) AND (score_4_count >= 0) AND (score_5_count >= 0) AND (score_6_count >= 0) AND (score_7_count >= 0) AND (score_8_count >= 0) AND (score_9_count >= 0) AND (score_10_count >= 0))),
    CONSTRAINT score_stat_total_count_check CHECK ((total_count = (((((((((score_1_count + score_2_count) + score_3_count) + score_4_count) + score_5_count) + score_6_count) + score_7_count) + score_8_count) + score_9_count) + score_10_count))),
    CONSTRAINT score_stat_total_score_check CHECK ((total_score = (((((((((score_1_count + (2 * score_2_count)) + (3 * score_3_count)) + (4 * score_4_count)) + (5 * score_5_count)) + (6 * score_6_count)) + (7 * score_7_count)) + (8 * score_8_count)) + (9 * score_9_count)) + (10 * score_10_count))))
);


--
-- Name: search_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_document (
    id uuid DEFAULT uuidv7() NOT NULL,
    document jsonb NOT NULL,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT search_document_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT search_document_document_check CHECK ((jsonb_typeof(document) = 'object'::text))
);


--
-- Name: search_document_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_document_revision (
    id uuid DEFAULT uuidv7() NOT NULL,
    search_document_id uuid NOT NULL,
    parent_revision_id uuid,
    source_revision_id uuid,
    content_id uuid NOT NULL,
    actor_profile_id uuid,
    edit_summary text,
    kind text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT search_document_revision_kind_check CHECK ((kind = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'restore'::text]))),
    CONSTRAINT search_document_revision_source_shape_check CHECK (((kind = 'restore'::text) = (source_revision_id IS NOT NULL)))
);


--
-- Name: search_document_revision_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_document_revision_head (
    search_document_id uuid NOT NULL,
    revision_id uuid NOT NULL
);


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id uuid NOT NULL,
    kind text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT series_kind_not_blank CHECK ((btrim(kind) <> ''::text))
);


--
-- Name: series_release; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_release (
    series_id uuid NOT NULL,
    release_unit_id uuid NOT NULL,
    "position" text NOT NULL COLLATE pg_catalog."C",
    released_on date,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT series_release_not_self_check CHECK ((series_id <> release_unit_id))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT uuidv7() NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    token text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    user_id uuid NOT NULL
);


--
-- Name: shared_search_query; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_search_query (
    id uuid DEFAULT uuidv7() NOT NULL,
    document jsonb NOT NULL,
    created_by_profile_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shared_search_query_document_check CHECK ((jsonb_typeof(document) = 'object'::text))
);


--
-- Name: software; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.software (
    id uuid NOT NULL,
    release_date date,
    version_label text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: software_requirement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.software_requirement (
    id uuid DEFAULT uuidv7() NOT NULL,
    software_id uuid NOT NULL,
    platform_entity_id uuid,
    tier text NOT NULL,
    source_link_id uuid,
    hardware jsonb NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT software_requirement_hardware_json_object_check CHECK (((hardware IS NULL) OR (jsonb_typeof(hardware) = 'object'::text))),
    CONSTRAINT software_requirement_tier_not_blank CHECK ((btrim(tier) <> ''::text))
);


--
-- Name: studio_resource_visit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_resource_visit (
    profile_id uuid NOT NULL,
    resource_unit_id uuid NOT NULL,
    last_visited_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: studio_work_relation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_work_relation (
    id uuid DEFAULT uuidv7() NOT NULL,
    profile_id uuid NOT NULL,
    resource_unit_id uuid NOT NULL,
    authorization_unit_id uuid NOT NULL,
    authorization_scope text[],
    authorization_scope_key text NOT NULL,
    relation text NOT NULL,
    source text NOT NULL,
    first_at timestamp(3) with time zone NOT NULL,
    last_at timestamp(3) with time zone NOT NULL,
    activity_count integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_work_relation_activity_count_check CHECK ((activity_count > 0)),
    CONSTRAINT studio_work_relation_relation_check CHECK ((relation = ANY (ARRAY['created'::text, 'contributed'::text]))),
    CONSTRAINT studio_work_relation_relation_source_check CHECK ((((relation = 'created'::text) AND (source = 'unit_status'::text)) OR ((relation = 'contributed'::text) AND (source = ANY (ARRAY['unit_revision'::text, 'content_structure_revision'::text, 'collection_structure_revision'::text, 'dock_revision'::text]))))),
    CONSTRAINT studio_work_relation_scope_key_check CHECK ((((authorization_scope IS NULL) AND (authorization_scope_key = '*'::text)) OR ((authorization_scope IS NOT NULL) AND (authorization_scope_key = array_to_string(authorization_scope, '/'::text))))),
    CONSTRAINT studio_work_relation_source_check CHECK ((source = ANY (ARRAY['unit_status'::text, 'unit_revision'::text, 'content_structure_revision'::text, 'collection_structure_revision'::text, 'dock_revision'::text]))),
    CONSTRAINT studio_work_relation_time_check CHECK ((first_at <= last_at))
);


--
-- Name: subject_association; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_association (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    role text NOT NULL,
    "position" text DEFAULT 'a0'::text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    context_post_id uuid,
    CONSTRAINT subject_association_not_self_check CHECK ((unit_id <> entity_id)),
    CONSTRAINT subject_association_role_check CHECK ((role = ANY (ARRAY['primary_character'::text, 'featured_character'::text, 'appears'::text, 'about'::text, 'setting'::text, 'source_work'::text, 'canonical_wiki_page'::text, 'related_subject'::text])))
);


--
-- Name: tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag (
    id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit (
    id uuid DEFAULT uuidv7() NOT NULL,
    kind text NOT NULL,
    status public.unit_status DEFAULT 'draft'::public.unit_status NOT NULL,
    visibility public.resource_visibility DEFAULT 'public'::public.resource_visibility NOT NULL,
    content_rating public.content_rating DEFAULT 'general'::public.content_rating NOT NULL,
    ai_disclosure public.ai_disclosure DEFAULT 'unknown'::public.ai_disclosure NOT NULL,
    license text,
    moderation_status public.moderation_status DEFAULT 'approved'::public.moderation_status NOT NULL,
    published_at timestamp(3) with time zone,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    post_targeting_locked boolean DEFAULT false NOT NULL,
    CONSTRAINT unit_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT unit_kind_check CHECK ((kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'structure'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]))),
    CONSTRAINT unit_publication_check CHECK (((status <> 'published'::public.unit_status) OR (published_at IS NOT NULL)))
);


--
-- Name: unit_access_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_access_grant (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    subject_kind public.unit_access_subject_kind NOT NULL,
    profile_id uuid,
    realm_id uuid,
    permission public.unit_permission NOT NULL,
    scope text[] DEFAULT ARRAY[]::text[] NOT NULL,
    granted_by_profile_id uuid NOT NULL,
    expires_at timestamp(3) with time zone,
    revoked_at timestamp(3) with time zone,
    revoked_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    realm_relation public.realm_access_subject_relation,
    CONSTRAINT unit_access_grant_expiry_check CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT unit_access_grant_permission_delegable_check CHECK ((permission <> ALL (ARRAY['unit.ownership.transfer'::public.unit_permission, 'unit.delete'::public.unit_permission]))),
    CONSTRAINT unit_access_grant_revocation_shape_check CHECK (((revoked_at IS NULL) = (revoked_by_profile_id IS NULL))),
    CONSTRAINT unit_access_grant_scope_check CHECK (((cardinality(scope) <= 8) AND ((cardinality(scope) = 0) OR (array_to_string(scope, '/'::text) ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'::text)))),
    CONSTRAINT unit_access_grant_subject_shape_check CHECK ((((subject_kind = 'profile'::public.unit_access_subject_kind) AND (profile_id IS NOT NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL)) OR ((subject_kind = 'realm'::public.unit_access_subject_kind) AND (profile_id IS NULL) AND (realm_id IS NOT NULL) AND (realm_relation IS NOT NULL)) OR ((subject_kind = 'authenticated'::public.unit_access_subject_kind) AND (profile_id IS NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL))))
);


--
-- Name: unit_access_invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_access_invitation (
    id uuid DEFAULT uuidv7() CONSTRAINT unit_access_invitation_v2_id_not_null NOT NULL,
    unit_id uuid CONSTRAINT unit_access_invitation_v2_unit_id_not_null NOT NULL,
    invited_profile_id uuid CONSTRAINT unit_access_invitation_v2_invited_profile_id_not_null NOT NULL,
    permissions public.unit_permission[] CONSTRAINT unit_access_invitation_v2_permissions_not_null NOT NULL,
    scope text[] DEFAULT ARRAY[]::text[] CONSTRAINT unit_access_invitation_v2_scope_not_null NOT NULL,
    invited_by_profile_id uuid CONSTRAINT unit_access_invitation_v2_invited_by_profile_id_not_null NOT NULL,
    expires_at timestamp(3) with time zone CONSTRAINT unit_access_invitation_v2_expires_at_not_null NOT NULL,
    access_expires_at timestamp(3) with time zone,
    resolution public.unit_access_invitation_resolution,
    resolved_at timestamp(3) with time zone,
    resolved_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() CONSTRAINT unit_access_invitation_v2_created_at_not_null NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() CONSTRAINT unit_access_invitation_v2_updated_at_not_null NOT NULL,
    CONSTRAINT unit_access_invitation_expiry_check CHECK (((expires_at > created_at) AND ((access_expires_at IS NULL) OR (access_expires_at > created_at)))),
    CONSTRAINT unit_access_invitation_permissions_check CHECK (((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 25) AND (array_position(permissions, 'unit.ownership.transfer'::public.unit_permission) IS NULL) AND (array_position(permissions, 'unit.delete'::public.unit_permission) IS NULL))),
    CONSTRAINT unit_access_invitation_profiles_differ_check CHECK ((invited_profile_id <> invited_by_profile_id)),
    CONSTRAINT unit_access_invitation_resolution_shape_check CHECK ((((resolution IS NULL) AND (resolved_at IS NULL) AND (resolved_by_profile_id IS NULL)) OR ((resolution IS NOT NULL) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL)))),
    CONSTRAINT unit_access_invitation_scope_check CHECK (((cardinality(scope) <= 8) AND ((cardinality(scope) = 0) OR (array_to_string(scope, '/'::text) ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'::text))))
);


--
-- Name: unit_access_restriction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_access_restriction (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    profile_id uuid,
    permission public.unit_permission NOT NULL,
    scope text[] DEFAULT ARRAY[]::text[] NOT NULL,
    created_by_profile_id uuid NOT NULL,
    expires_at timestamp(3) with time zone,
    revoked_at timestamp(3) with time zone,
    revoked_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    subject_kind public.unit_access_restriction_subject_kind NOT NULL,
    realm_id uuid,
    reason_code public.governance_reason_code NOT NULL,
    realm_relation public.realm_access_subject_relation,
    CONSTRAINT unit_access_restriction_expiry_check CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT unit_access_restriction_permission_delegable_check CHECK ((permission <> ALL (ARRAY['unit.ownership.transfer'::public.unit_permission, 'unit.delete'::public.unit_permission]))),
    CONSTRAINT unit_access_restriction_revocation_shape_check CHECK (((revoked_at IS NULL) = (revoked_by_profile_id IS NULL))),
    CONSTRAINT unit_access_restriction_scope_check CHECK (((cardinality(scope) <= 8) AND ((cardinality(scope) = 0) OR (array_to_string(scope, '/'::text) ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'::text)))),
    CONSTRAINT unit_access_restriction_subject_shape_check CHECK ((((subject_kind = 'profile'::public.unit_access_restriction_subject_kind) AND (profile_id IS NOT NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL)) OR ((subject_kind = 'realm'::public.unit_access_restriction_subject_kind) AND (profile_id IS NULL) AND (realm_id IS NOT NULL) AND (realm_relation IS NOT NULL))))
);


--
-- Name: unit_alias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_alias (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    term text NOT NULL,
    normalized_term text NOT NULL,
    language text,
    kind public.alias_kind DEFAULT 'common'::public.alias_kind NOT NULL,
    created_by_profile_id uuid,
    pinned boolean DEFAULT false NOT NULL,
    "position" text COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_alias_language_check CHECK (((language IS NULL) OR (language = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text])))),
    CONSTRAINT unit_alias_pinned_position_check CHECK (((pinned AND ("position" IS NOT NULL)) OR ((NOT pinned) AND ("position" IS NULL)))),
    CONSTRAINT unit_alias_term_not_blank CHECK (((btrim(term) <> ''::text) AND (btrim(normalized_term) <> ''::text)))
);


--
-- Name: unit_alias_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_alias_vote (
    alias_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_alias_vote_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: unit_alias_vote_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_alias_vote_stat (
    alias_id uuid NOT NULL,
    score bigint DEFAULT 0 NOT NULL,
    vote_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_alias_vote_stat_count_check CHECK ((vote_count >= 0)),
    CONSTRAINT unit_alias_vote_stat_score_check CHECK ((abs(score) <= vote_count))
);


--
-- Name: unit_association_proposal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_association_proposal (
    id uuid DEFAULT uuidv7() CONSTRAINT entity_association_proposal_id_not_null NOT NULL,
    source_unit_id uuid CONSTRAINT entity_association_proposal_source_unit_id_not_null NOT NULL,
    target_unit_id uuid CONSTRAINT entity_association_proposal_target_entity_id_not_null NOT NULL,
    kind public.association_kind CONSTRAINT entity_association_proposal_kind_not_null NOT NULL,
    role text CONSTRAINT entity_association_proposal_role_not_null NOT NULL,
    direction public.association_proposal_direction CONSTRAINT entity_association_proposal_direction_not_null NOT NULL,
    created_by_profile_id uuid CONSTRAINT entity_association_proposal_created_by_profile_id_not_null NOT NULL,
    expires_at timestamp(3) with time zone CONSTRAINT entity_association_proposal_expires_at_not_null NOT NULL,
    resolution public.association_proposal_resolution,
    resolved_at timestamp(3) with time zone,
    resolved_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() CONSTRAINT entity_association_proposal_created_at_not_null NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() CONSTRAINT entity_association_proposal_updated_at_not_null NOT NULL,
    context_post_id uuid,
    CONSTRAINT unit_association_proposal_context_post_shape_check CHECK ((((kind = 'credit'::public.association_kind) AND (context_post_id IS NULL)) OR (kind = 'subject'::public.association_kind))),
    CONSTRAINT unit_association_proposal_expiry_check CHECK ((expires_at > created_at)),
    CONSTRAINT unit_association_proposal_not_self_check CHECK ((source_unit_id <> target_unit_id)),
    CONSTRAINT unit_association_proposal_resolution_shape_check CHECK ((((resolution IS NULL) AND (resolved_at IS NULL) AND (resolved_by_profile_id IS NULL)) OR ((resolution IS NOT NULL) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL)))),
    CONSTRAINT unit_association_proposal_role_check CHECK ((((kind = 'credit'::public.association_kind) AND (role = ANY (ARRAY['author'::text, 'co-author'::text, 'translator'::text, 'illustrator'::text, 'editor'::text, 'publisher'::text, 'letterer'::text, 'colorist'::text, 'developer'::text, 'composer'::text, 'designer'::text, 'director'::text, 'producer'::text, 'writer'::text, 'actor'::text, 'narrator'::text, 'studio'::text, 'distributor'::text]))) OR ((kind = 'subject'::public.association_kind) AND (role = ANY (ARRAY['primary_character'::text, 'featured_character'::text, 'appears'::text, 'about'::text, 'setting'::text, 'source_work'::text, 'canonical_wiki_page'::text, 'related_subject'::text]))))),
    CONSTRAINT unit_association_proposal_role_not_blank CHECK ((btrim(role) <> ''::text))
);


--
-- Name: unit_content_license; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_content_license (
    unit_id uuid CONSTRAINT catalog_unit_content_license_unit_id_not_null NOT NULL,
    granted_at timestamp(3) with time zone DEFAULT now() CONSTRAINT catalog_unit_content_license_created_at_not_null NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    granted_by_profile_id uuid NOT NULL,
    reference_license_slug text NOT NULL,
    status public.unit_content_license_status DEFAULT 'active'::public.unit_content_license_status NOT NULL,
    CONSTRAINT unit_content_license_reference_slug_check CHECK ((reference_license_slug = 'rezics-unit-content-license-v1'::text))
);


--
-- Name: unit_dock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_dock (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    kind text NOT NULL,
    document jsonb NOT NULL,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_dock_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT unit_dock_kind_check CHECK ((kind = ANY (ARRAY['main'::text, 'wiki'::text])))
);


--
-- Name: unit_effective_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_effective_tag (
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    direct boolean DEFAULT false NOT NULL,
    structure_support_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_effective_tag_not_self_check CHECK ((unit_id <> tag_id)),
    CONSTRAINT unit_effective_tag_source_check CHECK ((direct OR (structure_support_count > 0))),
    CONSTRAINT unit_effective_tag_structure_count_check CHECK ((structure_support_count >= 0))
);


--
-- Name: unit_effective_tag_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_effective_tag_vote (
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_effective_tag_vote_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: unit_engagement_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_engagement_stat (
    unit_id uuid NOT NULL,
    upvotes bigint DEFAULT 0 NOT NULL,
    downvotes bigint DEFAULT 0 NOT NULL,
    replies bigint DEFAULT 0 NOT NULL,
    favorites bigint DEFAULT 0 NOT NULL,
    shares bigint DEFAULT 0 NOT NULL,
    high_scores bigint DEFAULT 0 NOT NULL,
    active_progress bigint DEFAULT 0 NOT NULL,
    completions bigint DEFAULT 0 NOT NULL,
    negative_progress bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_engagement_stat_count_check CHECK (((upvotes >= 0) AND (downvotes >= 0) AND (replies >= 0) AND (favorites >= 0) AND (shares >= 0) AND (high_scores >= 0) AND (active_progress >= 0) AND (completions >= 0) AND (negative_progress >= 0)))
);


--
-- Name: unit_follow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_follow (
    follower_profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    "position" text DEFAULT (('a0'::text || replace((uuidv7())::text, '-'::text, ''::text)) || 'V'::text) NOT NULL COLLATE pg_catalog."C",
    favorite boolean DEFAULT false NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_follow_not_self_check CHECK ((follower_profile_id <> unit_id))
);


--
-- Name: unit_follow_notification_preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_follow_notification_preference (
    follower_profile_id uuid CONSTRAINT unit_follow_notification_preferenc_follower_profile_id_not_null NOT NULL,
    unit_id uuid NOT NULL,
    in_app boolean DEFAULT true NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: unit_follow_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_follow_stat (
    unit_id uuid NOT NULL,
    follower_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_follow_stat_count_check CHECK ((follower_count >= 0))
);


--
-- Name: unit_localization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_localization (
    unit_id uuid NOT NULL,
    language text NOT NULL,
    "position" text DEFAULT (('a0'::text || replace((uuidv7())::text, '-'::text, ''::text)) || 'V'::text) NOT NULL COLLATE pg_catalog."C",
    cover_asset_id uuid,
    title text,
    summary text,
    description jsonb,
    content jsonb,
    content_status public.content_status,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    avatar_asset_id uuid,
    banner_asset_id uuid,
    avatar_type text,
    avatar_emoji text,
    avatar_icon_prefix text,
    avatar_icon_name text,
    CONSTRAINT unit_localization_avatar_type_check CHECK ((avatar_type = ANY (ARRAY['image'::text, 'emoji'::text, 'icon'::text]))),
    CONSTRAINT unit_localization_avatar_value_check CHECK ((((avatar_type IS NULL) AND (avatar_asset_id IS NULL) AND (avatar_emoji IS NULL) AND (avatar_icon_prefix IS NULL) AND (avatar_icon_name IS NULL)) OR ((avatar_type = 'image'::text) AND (avatar_asset_id IS NOT NULL) AND (avatar_emoji IS NULL) AND (avatar_icon_prefix IS NULL) AND (avatar_icon_name IS NULL)) OR ((avatar_type = 'emoji'::text) AND (avatar_asset_id IS NULL) AND (avatar_emoji IS NOT NULL) AND (char_length(avatar_emoji) <= 64) AND (avatar_icon_prefix IS NULL) AND (avatar_icon_name IS NULL)) OR ((avatar_type = 'icon'::text) AND (avatar_asset_id IS NULL) AND (avatar_emoji IS NULL) AND (avatar_icon_prefix = ANY (ARRAY['fas'::text, 'fab'::text])) AND (avatar_icon_name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text) AND (char_length(avatar_icon_name) <= 128)))),
    CONSTRAINT unit_localization_content_state_check CHECK (((content IS NULL) = (content_status IS NULL))),
    CONSTRAINT unit_localization_language_check CHECK ((language = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]))),
    CONSTRAINT unit_localization_value_check CHECK (((avatar_type IS NOT NULL) OR (banner_asset_id IS NOT NULL) OR (cover_asset_id IS NOT NULL) OR (title IS NOT NULL) OR (summary IS NOT NULL) OR (description IS NOT NULL) OR (content IS NOT NULL)))
);


--
-- Name: unit_localization_content_metric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_localization_content_metric (
    unit_id uuid NOT NULL,
    language text NOT NULL,
    word_count integer NOT NULL,
    character_count integer NOT NULL,
    algorithm_version integer NOT NULL,
    source_sha256 text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_localization_content_metric_algorithm_version_check CHECK ((algorithm_version > 0)),
    CONSTRAINT unit_localization_content_metric_character_count_check CHECK ((character_count >= 0)),
    CONSTRAINT unit_localization_content_metric_language_check CHECK ((language = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]))),
    CONSTRAINT unit_localization_content_metric_source_sha256_check CHECK ((source_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT unit_localization_content_metric_word_count_check CHECK ((word_count >= 0))
);


--
-- Name: unit_ownership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_ownership (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    assigned_by_profile_id uuid NOT NULL,
    revoked_at timestamp(3) with time zone,
    revoked_by_profile_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_ownership_revocation_shape_check CHECK (((revoked_at IS NULL) = (revoked_by_profile_id IS NULL)))
);


--
-- Name: unit_ownership_claim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_ownership_claim (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    claimant_profile_id uuid NOT NULL,
    source_ownership_id uuid NOT NULL,
    details text NOT NULL,
    resolution public.unit_ownership_claim_resolution,
    resolved_at timestamp(3) with time zone,
    resolved_by_profile_id uuid,
    resulting_ownership_id uuid,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_ownership_claim_details_length CHECK ((char_length(details) <= 2000)),
    CONSTRAINT unit_ownership_claim_details_not_blank CHECK ((btrim(details) <> ''::text)),
    CONSTRAINT unit_ownership_claim_distinct_ownership_check CHECK (((resulting_ownership_id IS NULL) OR (resulting_ownership_id <> source_ownership_id))),
    CONSTRAINT unit_ownership_claim_resolution_current_check CHECK ((resolution = ANY (ARRAY['approved'::public.unit_ownership_claim_resolution, 'rejected'::public.unit_ownership_claim_resolution, 'withdrawn'::public.unit_ownership_claim_resolution, 'superseded'::public.unit_ownership_claim_resolution]))),
    CONSTRAINT unit_ownership_claim_resolution_shape_check CHECK ((((resolution IS NULL) AND (resolved_at IS NULL) AND (resolved_by_profile_id IS NULL) AND (resulting_ownership_id IS NULL)) OR ((resolution = 'approved'::public.unit_ownership_claim_resolution) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL) AND (resulting_ownership_id IS NOT NULL)) OR ((resolution = ANY (ARRAY['rejected'::public.unit_ownership_claim_resolution, 'withdrawn'::public.unit_ownership_claim_resolution, 'superseded'::public.unit_ownership_claim_resolution])) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL) AND (resulting_ownership_id IS NULL))))
);


--
-- Name: unit_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_progress (
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    progress double precision DEFAULT 0 NOT NULL,
    status public.progress_status DEFAULT 'backlog'::public.progress_status NOT NULL,
    completed_count integer DEFAULT 0 NOT NULL,
    total_time_ms bigint DEFAULT 0 NOT NULL,
    first_seen_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    last_content_structure_node_id uuid,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    current_entry_id uuid,
    visibility public.resource_visibility DEFAULT 'public'::public.resource_visibility NOT NULL,
    current_basis text,
    CONSTRAINT unit_progress_count_check CHECK (((completed_count >= 0) AND (total_time_ms >= 0))),
    CONSTRAINT unit_progress_current_basis_check CHECK (((current_basis IS NULL) OR (current_basis = ANY (ARRAY['journal'::text, 'reading'::text])))),
    CONSTRAINT unit_progress_current_basis_shape_check CHECK (
CASE
    WHEN (current_basis IS NULL) THEN (current_entry_id IS NULL)
    WHEN (current_basis = 'journal'::text) THEN (current_entry_id IS NOT NULL)
    WHEN (current_basis = 'reading'::text) THEN (current_entry_id IS NULL)
    ELSE false
END),
    CONSTRAINT unit_progress_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT unit_progress_seen_check CHECK ((last_seen_at >= first_seen_at)),
    CONSTRAINT unit_progress_value_check CHECK (((progress >= (0)::double precision) AND (progress <= (1)::double precision)))
);


--
-- Name: unit_progress_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_progress_entry (
    id uuid DEFAULT uuidv7() NOT NULL,
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    entry_kind text NOT NULL,
    status public.progress_status NOT NULL,
    progress double precision NOT NULL,
    completion_delta integer DEFAULT 0 NOT NULL,
    total_time_ms bigint DEFAULT 0 NOT NULL,
    content_structure_node_id uuid,
    content_structure_revision_id uuid,
    occurred_at timestamp(3) with time zone,
    date_precision text NOT NULL,
    affects_current boolean DEFAULT false NOT NULL,
    deleted_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_progress_entry_completion_delta_check CHECK (((completion_delta >= 0) AND (completion_delta <= 1))),
    CONSTRAINT unit_progress_entry_completion_shape_check CHECK (((entry_kind <> 'completion'::text) OR ((status = 'completed'::public.progress_status) AND (progress = (1)::double precision) AND (completion_delta = 1) AND (content_structure_node_id IS NULL)))),
    CONSTRAINT unit_progress_entry_date_precision_check CHECK ((date_precision = ANY (ARRAY['instant'::text, 'day'::text, 'month'::text, 'year'::text, 'unknown'::text]))),
    CONSTRAINT unit_progress_entry_deleted_at_check CHECK (((deleted_at IS NULL) OR (deleted_at >= created_at))),
    CONSTRAINT unit_progress_entry_kind_check CHECK ((entry_kind = ANY (ARRAY['update'::text, 'completion'::text]))),
    CONSTRAINT unit_progress_entry_occurred_at_check CHECK (((date_precision = 'unknown'::text) = (occurred_at IS NULL))),
    CONSTRAINT unit_progress_entry_total_time_check CHECK ((total_time_ms >= 0)),
    CONSTRAINT unit_progress_entry_value_check CHECK (((progress >= (0)::double precision) AND (progress <= (1)::double precision)))
);


--
-- Name: unit_reaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_reaction (
    id uuid DEFAULT uuidv7() NOT NULL,
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    realm_id uuid,
    reaction public.reaction_kind NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: unit_reaction_global_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_reaction_global_stat (
    unit_id uuid NOT NULL,
    reaction public.reaction_kind NOT NULL,
    reaction_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_reaction_global_stat_count_check CHECK ((reaction_count >= 0))
);


--
-- Name: unit_reaction_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_reaction_stat (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    realm_id uuid,
    reaction public.reaction_kind NOT NULL,
    reaction_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_reaction_stat_count_check CHECK ((reaction_count >= 0))
);


--
-- Name: unit_reference_curation_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_reference_curation_head (
    unit_id uuid NOT NULL,
    kind text NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_reference_curation_head_kind_check CHECK ((kind = ANY (ARRAY['alias'::text, 'source_link'::text]))),
    CONSTRAINT unit_reference_curation_head_version_check CHECK ((version >= 0))
);


--
-- Name: unit_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_revision (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    parent_revision_id uuid,
    actor_profile_id uuid,
    edit_summary text,
    minor boolean DEFAULT false NOT NULL,
    byte_size integer NOT NULL,
    content_hidden boolean DEFAULT false NOT NULL,
    summary_hidden boolean DEFAULT false NOT NULL,
    actor_hidden boolean DEFAULT false NOT NULL,
    suppressed boolean DEFAULT false NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_revision_byte_size_check CHECK ((byte_size >= 0)),
    CONSTRAINT unit_revision_suppressed_check CHECK (((NOT suppressed) OR content_hidden OR summary_hidden OR actor_hidden))
);


--
-- Name: unit_revision_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_revision_head (
    unit_id uuid NOT NULL,
    revision_id uuid NOT NULL
);


--
-- Name: unit_revision_slot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_revision_slot (
    revision_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    role public.unit_revision_slot_role NOT NULL,
    content_id uuid NOT NULL,
    origin_revision_id uuid NOT NULL,
    slot_key text NOT NULL,
    CONSTRAINT unit_revision_slot_key_shape_check CHECK ((((role = 'localization'::public.unit_revision_slot_role) AND (slot_key = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]))) OR ((role <> 'localization'::public.unit_revision_slot_role) AND (slot_key = ''::text))))
);


--
-- Name: unit_revision_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_revision_tag (
    revision_id uuid NOT NULL,
    tag text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT unit_revision_tag_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT unit_revision_tag_not_blank CHECK ((btrim(tag) <> ''::text))
);


--
-- Name: unit_share; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_share (
    profile_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: unit_slug_address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_slug_address (
    id uuid DEFAULT uuidv7() NOT NULL,
    kind text NOT NULL,
    scope_unit_id uuid,
    slug text NOT NULL,
    target_unit_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_slug_address_kind_check CHECK ((kind = ANY (ARRAY['canonical'::text, 'redirect'::text]))),
    CONSTRAINT unit_slug_address_label_check CHECK ((slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'::text)),
    CONSTRAINT unit_slug_address_scope_not_target_check CHECK (((scope_unit_id IS NULL) OR (scope_unit_id <> target_unit_id)))
);


--
-- Name: unit_source_link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_source_link (
    id uuid DEFAULT uuidv7() CONSTRAINT unit_link_id_not_null NOT NULL,
    unit_id uuid CONSTRAINT unit_link_unit_id_not_null NOT NULL,
    source_entity_id uuid CONSTRAINT unit_link_source_entity_id_not_null NOT NULL,
    url text CONSTRAINT unit_link_url_not_null NOT NULL,
    normalized_url text CONSTRAINT unit_link_normalized_url_not_null NOT NULL,
    normalized_url_hash text CONSTRAINT unit_link_normalized_url_hash_not_null NOT NULL,
    created_by_profile_id uuid,
    pinned boolean DEFAULT false NOT NULL,
    "position" text COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() CONSTRAINT unit_link_created_at_not_null NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() CONSTRAINT unit_link_updated_at_not_null NOT NULL,
    CONSTRAINT unit_source_link_hash_check CHECK ((normalized_url_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT unit_source_link_pinned_position_check CHECK (((pinned AND ("position" IS NOT NULL)) OR ((NOT pinned) AND ("position" IS NULL)))),
    CONSTRAINT unit_source_link_url_check CHECK (((url ~ '^https?://'::text) AND (normalized_url ~ '^https?://'::text)))
);


--
-- Name: unit_source_link_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_source_link_vote (
    link_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_source_link_vote_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: unit_source_link_vote_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_source_link_vote_stat (
    link_id uuid NOT NULL,
    score bigint DEFAULT 0 NOT NULL,
    vote_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_source_link_vote_stat_count_check CHECK ((vote_count >= 0)),
    CONSTRAINT unit_source_link_vote_stat_score_check CHECK ((abs(score) <= vote_count))
);


--
-- Name: unit_status_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_status_event (
    id uuid DEFAULT uuidv7() NOT NULL,
    unit_id uuid NOT NULL,
    from_status public.unit_status,
    to_status public.unit_status NOT NULL,
    actor_kind public.unit_status_actor_kind NOT NULL,
    changed_by_profile_id uuid,
    revision_id uuid,
    actor_hidden boolean DEFAULT false NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_status_event_actor_shape_check CHECK ((((actor_kind = 'profile'::public.unit_status_actor_kind) AND (changed_by_profile_id IS NOT NULL)) OR ((actor_kind = ANY (ARRAY['system'::public.unit_status_actor_kind, 'import'::public.unit_status_actor_kind])) AND (changed_by_profile_id IS NULL)))),
    CONSTRAINT unit_status_event_transition_check CHECK (((from_status IS NULL) OR (from_status <> to_status)))
);


--
-- Name: unit_structure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure (
    id uuid NOT NULL,
    kind text NOT NULL,
    definition_version integer DEFAULT 1 NOT NULL,
    member_unit_ids uuid[] NOT NULL,
    created_by_profile_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_structure_definition_version_check CHECK ((definition_version = 1)),
    CONSTRAINT unit_structure_kind_check CHECK ((kind = 'tag.hierarchy_path'::text)),
    CONSTRAINT unit_structure_member_count_check CHECK (((cardinality(member_unit_ids) >= 2) AND (cardinality(member_unit_ids) <= 16))),
    CONSTRAINT unit_structure_member_null_check CHECK ((array_position(member_unit_ids, NULL::uuid) IS NULL)),
    CONSTRAINT unit_structure_not_self_check CHECK ((NOT (id = ANY (member_unit_ids))))
);


--
-- Name: unit_structure_application; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure_application (
    unit_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    created_by_profile_id uuid,
    pinned boolean DEFAULT false NOT NULL,
    "position" text COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_structure_application_not_self_check CHECK ((unit_id <> structure_id))
);


--
-- Name: unit_structure_application_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure_application_vote (
    unit_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_structure_application_vote_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: unit_structure_application_vote_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure_application_vote_stat (
    unit_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    score bigint DEFAULT 0 NOT NULL,
    vote_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_structure_application_vote_stat_count_check CHECK ((vote_count >= 0)),
    CONSTRAINT unit_structure_application_vote_stat_score_check CHECK ((abs(score) <= vote_count))
);


--
-- Name: unit_structure_edge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure_edge (
    structure_id uuid NOT NULL,
    ordinal integer NOT NULL,
    parent_unit_id uuid NOT NULL,
    child_unit_id uuid NOT NULL,
    CONSTRAINT unit_structure_edge_not_self_check CHECK ((parent_unit_id <> child_unit_id)),
    CONSTRAINT unit_structure_edge_ordinal_check CHECK ((ordinal >= 0))
);


--
-- Name: unit_structure_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure_member (
    structure_id uuid NOT NULL,
    ordinal integer NOT NULL,
    member_unit_id uuid NOT NULL,
    CONSTRAINT unit_structure_member_ordinal_check CHECK ((ordinal >= 0))
);


--
-- Name: unit_structure_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure_vote (
    structure_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_structure_vote_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: unit_structure_vote_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_structure_vote_stat (
    structure_id uuid NOT NULL,
    score bigint DEFAULT 0 NOT NULL,
    vote_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_structure_vote_stat_count_check CHECK ((vote_count >= 0)),
    CONSTRAINT unit_structure_vote_stat_score_check CHECK ((abs(score) <= vote_count))
);


--
-- Name: unit_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_tag (
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    "position" text COLLATE pg_catalog."C",
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_by_profile_id uuid,
    CONSTRAINT unit_tag_not_self_check CHECK ((unit_id <> tag_id)),
    CONSTRAINT unit_tag_pinned_position_check CHECK (((pinned AND ("position" IS NOT NULL)) OR ((NOT pinned) AND ("position" IS NULL))))
);


--
-- Name: unit_tag_structure_support; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_tag_structure_support (
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: unit_tag_vote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_tag_vote (
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    value integer NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_tag_vote_not_self_check CHECK ((unit_id <> tag_id)),
    CONSTRAINT unit_tag_vote_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: unit_tag_vote_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_tag_vote_stat (
    unit_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    score bigint DEFAULT 0 NOT NULL,
    vote_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unit_tag_vote_stat_count_check CHECK ((vote_count >= 0)),
    CONSTRAINT unit_tag_vote_stat_score_check CHECK ((abs(score) <= vote_count))
);


--
-- Name: unit_variant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_variant (
    variant_unit_id uuid CONSTRAINT unit_variant_unit_id_not_null NOT NULL,
    main_unit_id uuid CONSTRAINT unit_variant_canonical_unit_id_not_null NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    unit_kind text NOT NULL,
    CONSTRAINT unit_variant_kind_check CHECK ((unit_kind = ANY (ARRAY['book'::text, 'software'::text, 'media'::text]))),
    CONSTRAINT unit_variant_not_self_check CHECK ((variant_unit_id <> main_unit_id))
);


--
-- Name: user_account_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_account_state (
    user_id uuid NOT NULL,
    state public.user_account_state_value DEFAULT 'active'::public.user_account_state_value NOT NULL,
    reason public.user_account_state_reason,
    note text,
    expires_at timestamp(3) with time zone,
    updated_by_profile_id uuid NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_account_state_revision_check CHECK ((revision > 0)),
    CONSTRAINT user_account_state_shape_check CHECK ((((state = 'active'::public.user_account_state_value) AND (reason IS NULL) AND (note IS NULL) AND (expires_at IS NULL)) OR ((state = 'suspended'::public.user_account_state_value) AND (reason IS NOT NULL)) OR ((state = 'closed'::public.user_account_state_value) AND (reason IS NOT NULL) AND (expires_at IS NULL))))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    registration_content_language text DEFAULT 'en'::text NOT NULL,
    CONSTRAINT users_registration_content_language_check CHECK ((registration_content_language = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text])))
);


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id uuid DEFAULT uuidv7() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: video; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video (
    id uuid NOT NULL,
    duration_seconds integer,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT video_duration_seconds_check CHECK (((duration_seconds IS NULL) OR (duration_seconds > 0)))
);


--
-- Name: zone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone (
    id uuid NOT NULL,
    boundary_document jsonb NOT NULL,
    theme_document jsonb NOT NULL,
    starts_at timestamp(3) with time zone,
    ends_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT zone_time_range_check CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at)))
);


--
-- Name: zone_page; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone_page (
    id uuid NOT NULL,
    zone_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: zone_search_feature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone_search_feature (
    zone_id uuid NOT NULL,
    search_document_id uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_enforcement account_enforcement_decision_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_enforcement
    ADD CONSTRAINT account_enforcement_decision_action_key UNIQUE (decision_action_id);


--
-- Name: account_enforcement account_enforcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_enforcement
    ADD CONSTRAINT account_enforcement_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: api_account_quota_binding api_account_quota_binding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_account_quota_binding
    ADD CONSTRAINT api_account_quota_binding_pkey PRIMARY KEY (user_id);


--
-- Name: api_quota_daily_usage api_quota_daily_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_daily_usage
    ADD CONSTRAINT api_quota_daily_usage_pkey PRIMARY KEY (id);


--
-- Name: api_quota_policy api_quota_policy_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_policy
    ADD CONSTRAINT api_quota_policy_key_key UNIQUE (key);


--
-- Name: api_quota_policy api_quota_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_policy
    ADD CONSTRAINT api_quota_policy_pkey PRIMARY KEY (id);


--
-- Name: api_quota_policy_revision api_quota_policy_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_policy_revision
    ADD CONSTRAINT api_quota_policy_revision_pkey PRIMARY KEY (policy_id, revision);


--
-- Name: api_quota_rate_state api_quota_rate_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_rate_state
    ADD CONSTRAINT api_quota_rate_state_pkey PRIMARY KEY (id);


--
-- Name: api_quota_request_lease api_quota_request_lease_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_request_lease
    ADD CONSTRAINT api_quota_request_lease_pkey PRIMARY KEY (id);


--
-- Name: api_token_creation_reservation api_token_creation_reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_creation_reservation
    ADD CONSTRAINT api_token_creation_reservation_pkey PRIMARY KEY (id);


--
-- Name: api_token_quota_binding api_token_quota_binding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_quota_binding
    ADD CONSTRAINT api_token_quota_binding_pkey PRIMARY KEY (token_id);


--
-- Name: api_token_quota_override api_token_quota_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_quota_override
    ADD CONSTRAINT api_token_quota_override_pkey PRIMARY KEY (token_id);


--
-- Name: apikeys apikeys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apikeys
    ADD CONSTRAINT apikeys_pkey PRIMARY KEY (id);


--
-- Name: audio audio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio
    ADD CONSTRAINT audio_pkey PRIMARY KEY (id);


--
-- Name: audit_event audit_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_event
    ADD CONSTRAINT audit_event_pkey PRIMARY KEY (id);


--
-- Name: book_chapter_progress_stat book_chapter_progress_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_chapter_progress_stat
    ADD CONSTRAINT book_chapter_progress_stat_pkey PRIMARY KEY (profile_id, book_unit_id);


--
-- Name: book_chapter_stat book_chapter_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_chapter_stat
    ADD CONSTRAINT book_chapter_stat_pkey PRIMARY KEY (book_unit_id);


--
-- Name: book_localized_content_metric_stat book_localized_content_metric_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_localized_content_metric_stat
    ADD CONSTRAINT book_localized_content_metric_stat_pkey PRIMARY KEY (book_unit_id, language);


--
-- Name: book book_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book
    ADD CONSTRAINT book_pkey PRIMARY KEY (id);


--
-- Name: collection_item collection_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_item
    ADD CONSTRAINT collection_item_pkey PRIMARY KEY (collection_id, unit_id);


--
-- Name: collection_item collection_item_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_item
    ADD CONSTRAINT collection_item_position_unique UNIQUE (collection_id, "position");


--
-- Name: collection collection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection
    ADD CONSTRAINT collection_pkey PRIMARY KEY (id);


--
-- Name: collection_stat collection_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_stat
    ADD CONSTRAINT collection_stat_pkey PRIMARY KEY (collection_id);


--
-- Name: collection_structure_revision_head collection_structure_revision_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision_head
    ADD CONSTRAINT collection_structure_revision_head_pkey PRIMARY KEY (collection_id);


--
-- Name: collection_structure_revision_head collection_structure_revision_head_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision_head
    ADD CONSTRAINT collection_structure_revision_head_revision_key UNIQUE (revision_id);


--
-- Name: collection_structure_revision collection_structure_revision_id_collection_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision
    ADD CONSTRAINT collection_structure_revision_id_collection_key UNIQUE (id, collection_id);


--
-- Name: collection_structure_revision collection_structure_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision
    ADD CONSTRAINT collection_structure_revision_pkey PRIMARY KEY (id);


--
-- Name: content_structure content_structure_id_owner_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure
    ADD CONSTRAINT content_structure_id_owner_key UNIQUE (id, owner_unit_id);


--
-- Name: content_structure_node content_structure_node_id_owner_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node
    ADD CONSTRAINT content_structure_node_id_owner_key UNIQUE (id, owner_unit_id);


--
-- Name: content_structure_node content_structure_node_id_structure_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node
    ADD CONSTRAINT content_structure_node_id_structure_key UNIQUE (id, structure_id);


--
-- Name: content_structure_node content_structure_node_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node
    ADD CONSTRAINT content_structure_node_pkey PRIMARY KEY (id);


--
-- Name: content_structure_node_progress content_structure_node_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node_progress
    ADD CONSTRAINT content_structure_node_progress_pkey PRIMARY KEY (profile_id, node_id);


--
-- Name: content_structure content_structure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure
    ADD CONSTRAINT content_structure_pkey PRIMARY KEY (id);


--
-- Name: content_structure_revision_head content_structure_revision_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision_head
    ADD CONSTRAINT content_structure_revision_head_pkey PRIMARY KEY (structure_id);


--
-- Name: content_structure_revision_head content_structure_revision_head_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision_head
    ADD CONSTRAINT content_structure_revision_head_revision_key UNIQUE (revision_id);


--
-- Name: content_structure_revision content_structure_revision_id_structure_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision
    ADD CONSTRAINT content_structure_revision_id_structure_key UNIQUE (id, structure_id);


--
-- Name: content_structure_revision content_structure_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision
    ADD CONSTRAINT content_structure_revision_pkey PRIMARY KEY (id);


--
-- Name: conversation conversation_participant_pair_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_participant_pair_key UNIQUE (participant_low_profile_id, participant_high_profile_id);


--
-- Name: conversation_participant_stat conversation_participant_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant_stat
    ADD CONSTRAINT conversation_participant_stat_pkey PRIMARY KEY (conversation_id, profile_id);


--
-- Name: conversation conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_pkey PRIMARY KEY (id);


--
-- Name: conversation_read conversation_read_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_read
    ADD CONSTRAINT conversation_read_pkey PRIMARY KEY (conversation_id, profile_id);


--
-- Name: conversation_stat conversation_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_stat
    ADD CONSTRAINT conversation_stat_pkey PRIMARY KEY (conversation_id);


--
-- Name: credit_attribution credit_attribution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_attribution
    ADD CONSTRAINT credit_attribution_pkey PRIMARY KEY (id);


--
-- Name: credit_attribution credit_attribution_source_credited_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_attribution
    ADD CONSTRAINT credit_attribution_source_credited_role_key UNIQUE (source_unit_id, credited_unit_id, role);


--
-- Name: dock_revision_head dock_revision_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision_head
    ADD CONSTRAINT dock_revision_head_pkey PRIMARY KEY (dock_id);


--
-- Name: dock_revision_head dock_revision_head_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision_head
    ADD CONSTRAINT dock_revision_head_revision_key UNIQUE (revision_id);


--
-- Name: dock_revision dock_revision_id_dock_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision
    ADD CONSTRAINT dock_revision_id_dock_key UNIQUE (id, dock_id);


--
-- Name: dock_revision dock_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision
    ADD CONSTRAINT dock_revision_pkey PRIMARY KEY (id);


--
-- Name: email_outbox email_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);


--
-- Name: entity entity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_pkey PRIMARY KEY (id);


--
-- Name: governance_post_binding governance_post_binding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_post_binding
    ADD CONSTRAINT governance_post_binding_pkey PRIMARY KEY (post_id);


--
-- Name: image_asset image_asset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_asset
    ADD CONSTRAINT image_asset_pkey PRIMARY KEY (id);


--
-- Name: image_asset_presentation image_asset_presentation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_asset_presentation
    ADD CONSTRAINT image_asset_presentation_pkey PRIMARY KEY (asset_id, role);


--
-- Name: image_object image_object_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_object
    ADD CONSTRAINT image_object_asset_id_key UNIQUE (asset_id);


--
-- Name: image_object image_object_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_object
    ADD CONSTRAINT image_object_pkey PRIMARY KEY (id);


--
-- Name: image_object image_object_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_object
    ADD CONSTRAINT image_object_storage_key_key UNIQUE (storage_key);


--
-- Name: label label_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label
    ADD CONSTRAINT label_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: message message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);


--
-- Name: moderation_action moderation_action_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_action
    ADD CONSTRAINT moderation_action_pkey PRIMARY KEY (id);


--
-- Name: moderation_case moderation_case_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_case
    ADD CONSTRAINT moderation_case_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: notification_preference notification_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preference
    ADD CONSTRAINT notification_preference_pkey PRIMARY KEY (profile_id, kind);


--
-- Name: notification_recipient_stat notification_recipient_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_recipient_stat
    ADD CONSTRAINT notification_recipient_stat_pkey PRIMARY KEY (profile_id);


--
-- Name: platform_capability_grant platform_capability_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_capability_grant
    ADD CONSTRAINT platform_capability_grant_pkey PRIMARY KEY (id);


--
-- Name: platform_unit_report platform_unit_report_case_reporter_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_case_reporter_key UNIQUE (case_id, reporter_profile_id);


--
-- Name: platform_unit_report platform_unit_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_pkey PRIMARY KEY (id);


--
-- Name: poll_option poll_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_option
    ADD CONSTRAINT poll_option_pkey PRIMARY KEY (id);


--
-- Name: poll_option poll_option_poll_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_option
    ADD CONSTRAINT poll_option_poll_id_key UNIQUE (poll_id, id);


--
-- Name: poll_option_vote_stat poll_option_vote_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_option_vote_stat
    ADD CONSTRAINT poll_option_vote_stat_pkey PRIMARY KEY (option_id);


--
-- Name: poll poll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll
    ADD CONSTRAINT poll_pkey PRIMARY KEY (id);


--
-- Name: poll_vote poll_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_vote
    ADD CONSTRAINT poll_vote_pkey PRIMARY KEY (poll_id, profile_id, option_id);


--
-- Name: post post_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_pkey PRIMARY KEY (id);


--
-- Name: post_progress_entry post_progress_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_progress_entry
    ADD CONSTRAINT post_progress_entry_pkey PRIMARY KEY (post_id);


--
-- Name: post_progress_entry post_progress_entry_post_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_progress_entry
    ADD CONSTRAINT post_progress_entry_post_position_key UNIQUE (post_id, "position");


--
-- Name: post_progress_entry post_progress_entry_progress_entry_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_progress_entry
    ADD CONSTRAINT post_progress_entry_progress_entry_key UNIQUE (progress_entry_id);


--
-- Name: post_reply post_reply_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reply
    ADD CONSTRAINT post_reply_pkey PRIMARY KEY (post_id);


--
-- Name: post_reply post_reply_post_root_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reply
    ADD CONSTRAINT post_reply_post_root_key UNIQUE (post_id, root_post_id);


--
-- Name: post_reply_stat post_reply_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reply_stat
    ADD CONSTRAINT post_reply_stat_pkey PRIMARY KEY (post_id);


--
-- Name: post_score post_score_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_score
    ADD CONSTRAINT post_score_pkey PRIMARY KEY (post_id, score_id);


--
-- Name: post_score post_score_post_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_score
    ADD CONSTRAINT post_score_post_position_key UNIQUE (post_id, "position");


--
-- Name: profile profile_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: profile_block profile_block_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_block
    ADD CONSTRAINT profile_block_pkey PRIMARY KEY (blocker_profile_id, blocked_profile_id);


--
-- Name: profile_favorites_collection profile_favorites_collection_collection_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_favorites_collection
    ADD CONSTRAINT profile_favorites_collection_collection_id_unique UNIQUE (collection_id);


--
-- Name: profile_favorites_collection profile_favorites_collection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_favorites_collection
    ADD CONSTRAINT profile_favorites_collection_pkey PRIMARY KEY (profile_id);


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (id);


--
-- Name: profile_preference profile_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_preference
    ADD CONSTRAINT profile_preference_pkey PRIMARY KEY (profile_id);


--
-- Name: profile_realm_tag_subscription profile_realm_tag_subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_realm_tag_subscription
    ADD CONSTRAINT profile_realm_tag_subscription_pkey PRIMARY KEY (profile_id, realm_id);


--
-- Name: profile_unit_tag profile_unit_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_unit_tag
    ADD CONSTRAINT profile_unit_tag_pkey PRIMARY KEY (profile_id, unit_id, tag_id);


--
-- Name: realm_member realm_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_member
    ADD CONSTRAINT realm_member_pkey PRIMARY KEY (realm_id, profile_id);


--
-- Name: realm_pin realm_pin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_pin
    ADD CONSTRAINT realm_pin_pkey PRIMARY KEY (realm_id, unit_id);


--
-- Name: realm realm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm
    ADD CONSTRAINT realm_pkey PRIMARY KEY (id);


--
-- Name: realm_rule_acceptance realm_rule_acceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_acceptance
    ADD CONSTRAINT realm_rule_acceptance_pkey PRIMARY KEY (revision_id, profile_id);


--
-- Name: realm_rule realm_rule_id_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule
    ADD CONSTRAINT realm_rule_id_revision_key UNIQUE (id, revision_id);


--
-- Name: realm_rule realm_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule
    ADD CONSTRAINT realm_rule_pkey PRIMARY KEY (id);


--
-- Name: realm_rule_revision realm_rule_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_revision
    ADD CONSTRAINT realm_rule_revision_pkey PRIMARY KEY (id);


--
-- Name: realm_rule_revision realm_rule_revision_realm_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_revision
    ADD CONSTRAINT realm_rule_revision_realm_id_key UNIQUE (realm_id, id);


--
-- Name: realm_rule_revision realm_rule_revision_realm_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_revision
    ADD CONSTRAINT realm_rule_revision_realm_version_key UNIQUE (realm_id, version);


--
-- Name: realm_score_context realm_score_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_score_context
    ADD CONSTRAINT realm_score_context_pkey PRIMARY KEY (realm_id);


--
-- Name: realm_stat realm_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_stat
    ADD CONSTRAINT realm_stat_pkey PRIMARY KEY (realm_id);


--
-- Name: realm_tag_context realm_tag_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_context
    ADD CONSTRAINT realm_tag_context_pkey PRIMARY KEY (realm_id, tag_id);


--
-- Name: realm_tag_vote realm_tag_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote
    ADD CONSTRAINT realm_tag_vote_pkey PRIMARY KEY (realm_id, unit_id, tag_id, profile_id);


--
-- Name: realm_tag_vote_stat realm_tag_vote_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote_stat
    ADD CONSTRAINT realm_tag_vote_stat_pkey PRIMARY KEY (realm_id, unit_id, tag_id);


--
-- Name: realm_unit_moderation_stat realm_unit_moderation_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_moderation_stat
    ADD CONSTRAINT realm_unit_moderation_stat_pkey PRIMARY KEY (realm_id, unit_id);


--
-- Name: realm_unit realm_unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit
    ADD CONSTRAINT realm_unit_pkey PRIMARY KEY (realm_id, unit_id);


--
-- Name: realm_unit_publication_event realm_unit_publication_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_publication_event
    ADD CONSTRAINT realm_unit_publication_event_pkey PRIMARY KEY (id);


--
-- Name: realm_unit_report realm_unit_report_case_reporter_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_case_reporter_key UNIQUE (case_id, reporter_profile_id);


--
-- Name: realm_unit_report realm_unit_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_pkey PRIMARY KEY (id);


--
-- Name: realm_unit_status_event realm_unit_status_event_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_status_event
    ADD CONSTRAINT realm_unit_status_event_action_key UNIQUE (moderation_action_id);


--
-- Name: realm_unit_status_event realm_unit_status_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_status_event
    ADD CONSTRAINT realm_unit_status_event_pkey PRIMARY KEY (id);


--
-- Name: realm_unit_tag realm_unit_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_tag
    ADD CONSTRAINT realm_unit_tag_pkey PRIMARY KEY (realm_id, unit_id, tag_id);


--
-- Name: recommendation_event recommendation_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_event
    ADD CONSTRAINT recommendation_event_pkey PRIMARY KEY (id);


--
-- Name: recommendation_event recommendation_event_request_target_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_event
    ADD CONSTRAINT recommendation_event_request_target_type_key UNIQUE (request_id, target_unit_id, type);


--
-- Name: recommendation_exclusion recommendation_exclusion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_exclusion
    ADD CONSTRAINT recommendation_exclusion_pkey PRIMARY KEY (profile_id, unit_id);


--
-- Name: recommendation_metric_daily recommendation_metric_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_metric_daily
    ADD CONSTRAINT recommendation_metric_daily_pkey PRIMARY KEY (day, surface, policy_version);


--
-- Name: recommendation_profile_interest recommendation_profile_interest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_profile_interest
    ADD CONSTRAINT recommendation_profile_interest_pkey PRIMARY KEY (snapshot_id, profile_id, unit_id);


--
-- Name: recommendation_profile_signal_hourly recommendation_profile_signal_hourly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_profile_signal_hourly
    ADD CONSTRAINT recommendation_profile_signal_hourly_pkey PRIMARY KEY (profile_id, unit_id, bucket_start, kind);


--
-- Name: recommendation_snapshot recommendation_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_snapshot
    ADD CONSTRAINT recommendation_snapshot_pkey PRIMARY KEY (id);


--
-- Name: recommendation_unit_edge recommendation_unit_edge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_edge
    ADD CONSTRAINT recommendation_unit_edge_pkey PRIMARY KEY (snapshot_id, source_unit_id, target_unit_id);


--
-- Name: recommendation_unit_signal_hourly recommendation_unit_signal_hourly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_signal_hourly
    ADD CONSTRAINT recommendation_unit_signal_hourly_pkey PRIMARY KEY (unit_id, bucket_start, kind);


--
-- Name: recommendation_unit_stat recommendation_unit_stat_identity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_stat
    ADD CONSTRAINT recommendation_unit_stat_identity_key UNIQUE NULLS NOT DISTINCT (snapshot_id, unit_id, context_realm_id);


--
-- Name: recommendation_unit_stat recommendation_unit_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_stat
    ADD CONSTRAINT recommendation_unit_stat_pkey PRIMARY KEY (id);


--
-- Name: release release_parent_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release
    ADD CONSTRAINT release_parent_version_key UNIQUE (parent_unit_id, version_label);


--
-- Name: release release_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release
    ADD CONSTRAINT release_pkey PRIMARY KEY (id);


--
-- Name: revision_content revision_content_model_sha256_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_content
    ADD CONSTRAINT revision_content_model_sha256_key UNIQUE (model, sha256);


--
-- Name: revision_content revision_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_content
    ADD CONSTRAINT revision_content_pkey PRIMARY KEY (id);


--
-- Name: score score_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score
    ADD CONSTRAINT score_pkey PRIMARY KEY (id);


--
-- Name: score score_profile_unit_realm_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score
    ADD CONSTRAINT score_profile_unit_realm_key UNIQUE (profile_id, unit_id, realm_id);


--
-- Name: score_stat score_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score_stat
    ADD CONSTRAINT score_stat_pkey PRIMARY KEY (unit_id, realm_id);


--
-- Name: search_document search_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document
    ADD CONSTRAINT search_document_pkey PRIMARY KEY (id);


--
-- Name: search_document_revision_head search_document_revision_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision_head
    ADD CONSTRAINT search_document_revision_head_pkey PRIMARY KEY (search_document_id);


--
-- Name: search_document_revision_head search_document_revision_head_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision_head
    ADD CONSTRAINT search_document_revision_head_revision_key UNIQUE (revision_id);


--
-- Name: search_document_revision search_document_revision_id_document_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision
    ADD CONSTRAINT search_document_revision_id_document_key UNIQUE (id, search_document_id);


--
-- Name: search_document_revision search_document_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision
    ADD CONSTRAINT search_document_revision_pkey PRIMARY KEY (id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: series_release series_release_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_release
    ADD CONSTRAINT series_release_pkey PRIMARY KEY (series_id, release_unit_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: shared_search_query shared_search_query_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_search_query
    ADD CONSTRAINT shared_search_query_pkey PRIMARY KEY (id);


--
-- Name: software software_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software
    ADD CONSTRAINT software_pkey PRIMARY KEY (id);


--
-- Name: software_requirement software_requirement_identity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_requirement
    ADD CONSTRAINT software_requirement_identity_key UNIQUE NULLS NOT DISTINCT (software_id, platform_entity_id, tier);


--
-- Name: software_requirement software_requirement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_requirement
    ADD CONSTRAINT software_requirement_pkey PRIMARY KEY (id);


--
-- Name: studio_resource_visit studio_resource_visit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_resource_visit
    ADD CONSTRAINT studio_resource_visit_pkey PRIMARY KEY (profile_id, resource_unit_id);


--
-- Name: studio_work_relation studio_work_relation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_work_relation
    ADD CONSTRAINT studio_work_relation_pkey PRIMARY KEY (id);


--
-- Name: subject_association subject_association_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_association
    ADD CONSTRAINT subject_association_pkey PRIMARY KEY (id);


--
-- Name: subject_association subject_association_unit_entity_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_association
    ADD CONSTRAINT subject_association_unit_entity_role_key UNIQUE (unit_id, entity_id, role);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: unit_access_grant unit_access_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_grant
    ADD CONSTRAINT unit_access_grant_pkey PRIMARY KEY (id);


--
-- Name: unit_access_invitation unit_access_invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_invitation
    ADD CONSTRAINT unit_access_invitation_pkey PRIMARY KEY (id);


--
-- Name: unit_access_restriction unit_access_restriction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_restriction
    ADD CONSTRAINT unit_access_restriction_pkey PRIMARY KEY (id);


--
-- Name: unit_alias unit_alias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias
    ADD CONSTRAINT unit_alias_pkey PRIMARY KEY (id);


--
-- Name: unit_alias unit_alias_unit_language_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias
    ADD CONSTRAINT unit_alias_unit_language_normalized_key UNIQUE NULLS NOT DISTINCT (unit_id, language, normalized_term);


--
-- Name: unit_alias_vote unit_alias_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias_vote
    ADD CONSTRAINT unit_alias_vote_pkey PRIMARY KEY (alias_id, profile_id);


--
-- Name: unit_alias_vote_stat unit_alias_vote_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias_vote_stat
    ADD CONSTRAINT unit_alias_vote_stat_pkey PRIMARY KEY (alias_id);


--
-- Name: unit_association_proposal unit_association_proposal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_association_proposal
    ADD CONSTRAINT unit_association_proposal_pkey PRIMARY KEY (id);


--
-- Name: unit_content_license unit_content_license_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_content_license
    ADD CONSTRAINT unit_content_license_pkey PRIMARY KEY (id);


--
-- Name: unit_dock unit_dock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_dock
    ADD CONSTRAINT unit_dock_pkey PRIMARY KEY (id);


--
-- Name: unit_dock unit_dock_unit_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_dock
    ADD CONSTRAINT unit_dock_unit_kind_key UNIQUE (unit_id, kind);


--
-- Name: unit_effective_tag unit_effective_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_effective_tag
    ADD CONSTRAINT unit_effective_tag_pkey PRIMARY KEY (unit_id, tag_id);


--
-- Name: unit_effective_tag_vote unit_effective_tag_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_effective_tag_vote
    ADD CONSTRAINT unit_effective_tag_vote_pkey PRIMARY KEY (unit_id, tag_id, profile_id);


--
-- Name: unit_engagement_stat unit_engagement_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_engagement_stat
    ADD CONSTRAINT unit_engagement_stat_pkey PRIMARY KEY (unit_id);


--
-- Name: unit_follow_notification_preference unit_follow_notification_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_follow_notification_preference
    ADD CONSTRAINT unit_follow_notification_preference_pkey PRIMARY KEY (follower_profile_id, unit_id);


--
-- Name: unit_follow unit_follow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_follow
    ADD CONSTRAINT unit_follow_pkey PRIMARY KEY (follower_profile_id, unit_id);


--
-- Name: unit_follow_stat unit_follow_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_follow_stat
    ADD CONSTRAINT unit_follow_stat_pkey PRIMARY KEY (unit_id);


--
-- Name: unit unit_id_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit
    ADD CONSTRAINT unit_id_kind_key UNIQUE (id, kind);


--
-- Name: unit_localization_content_metric unit_localization_content_metric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization_content_metric
    ADD CONSTRAINT unit_localization_content_metric_pkey PRIMARY KEY (unit_id, language);


--
-- Name: unit_localization unit_localization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization
    ADD CONSTRAINT unit_localization_pkey PRIMARY KEY (unit_id, language);


--
-- Name: unit_localization unit_localization_unit_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization
    ADD CONSTRAINT unit_localization_unit_position_key UNIQUE (unit_id, "position");


--
-- Name: unit_ownership_claim unit_ownership_claim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership_claim
    ADD CONSTRAINT unit_ownership_claim_pkey PRIMARY KEY (id);


--
-- Name: unit_ownership unit_ownership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership
    ADD CONSTRAINT unit_ownership_pkey PRIMARY KEY (id);


--
-- Name: unit unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit
    ADD CONSTRAINT unit_pkey PRIMARY KEY (id);


--
-- Name: unit_progress_entry unit_progress_entry_id_profile_unit_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress_entry
    ADD CONSTRAINT unit_progress_entry_id_profile_unit_key UNIQUE (id, profile_id, unit_id);


--
-- Name: unit_progress_entry unit_progress_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress_entry
    ADD CONSTRAINT unit_progress_entry_pkey PRIMARY KEY (id);


--
-- Name: unit_progress unit_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress
    ADD CONSTRAINT unit_progress_pkey PRIMARY KEY (profile_id, unit_id);


--
-- Name: unit_reaction_global_stat unit_reaction_global_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction_global_stat
    ADD CONSTRAINT unit_reaction_global_stat_pkey PRIMARY KEY (unit_id, reaction);


--
-- Name: unit_reaction unit_reaction_identity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction
    ADD CONSTRAINT unit_reaction_identity_key UNIQUE NULLS NOT DISTINCT (profile_id, unit_id, realm_id);


--
-- Name: unit_reaction unit_reaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction
    ADD CONSTRAINT unit_reaction_pkey PRIMARY KEY (id);


--
-- Name: unit_reaction_stat unit_reaction_stat_identity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction_stat
    ADD CONSTRAINT unit_reaction_stat_identity_key UNIQUE NULLS NOT DISTINCT (unit_id, realm_id, reaction);


--
-- Name: unit_reaction_stat unit_reaction_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction_stat
    ADD CONSTRAINT unit_reaction_stat_pkey PRIMARY KEY (id);


--
-- Name: unit_reference_curation_head unit_reference_curation_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reference_curation_head
    ADD CONSTRAINT unit_reference_curation_head_pkey PRIMARY KEY (unit_id, kind);


--
-- Name: unit_revision_head unit_revision_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_head
    ADD CONSTRAINT unit_revision_head_pkey PRIMARY KEY (unit_id);


--
-- Name: unit_revision_head unit_revision_head_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_head
    ADD CONSTRAINT unit_revision_head_revision_key UNIQUE (revision_id);


--
-- Name: unit_revision unit_revision_id_unit_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision
    ADD CONSTRAINT unit_revision_id_unit_key UNIQUE (id, unit_id);


--
-- Name: unit_revision unit_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision
    ADD CONSTRAINT unit_revision_pkey PRIMARY KEY (id);


--
-- Name: unit_revision_slot unit_revision_slot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_slot
    ADD CONSTRAINT unit_revision_slot_pkey PRIMARY KEY (revision_id, role, slot_key);


--
-- Name: unit_revision_tag unit_revision_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_tag
    ADD CONSTRAINT unit_revision_tag_pkey PRIMARY KEY (revision_id, tag);


--
-- Name: unit_share unit_share_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_share
    ADD CONSTRAINT unit_share_pkey PRIMARY KEY (profile_id, unit_id);


--
-- Name: unit_slug_address unit_slug_address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_slug_address
    ADD CONSTRAINT unit_slug_address_pkey PRIMARY KEY (id);


--
-- Name: unit_slug_address unit_slug_address_scope_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_slug_address
    ADD CONSTRAINT unit_slug_address_scope_slug_key UNIQUE NULLS NOT DISTINCT (scope_unit_id, slug);


--
-- Name: unit_source_link unit_source_link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link
    ADD CONSTRAINT unit_source_link_pkey PRIMARY KEY (id);


--
-- Name: unit_source_link unit_source_link_unit_source_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link
    ADD CONSTRAINT unit_source_link_unit_source_hash_key UNIQUE (unit_id, source_entity_id, normalized_url_hash);


--
-- Name: unit_source_link_vote unit_source_link_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link_vote
    ADD CONSTRAINT unit_source_link_vote_pkey PRIMARY KEY (link_id, profile_id);


--
-- Name: unit_source_link_vote_stat unit_source_link_vote_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link_vote_stat
    ADD CONSTRAINT unit_source_link_vote_stat_pkey PRIMARY KEY (link_id);


--
-- Name: unit_status_event unit_status_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_status_event
    ADD CONSTRAINT unit_status_event_pkey PRIMARY KEY (id);


--
-- Name: unit_structure_application unit_structure_application_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application
    ADD CONSTRAINT unit_structure_application_pkey PRIMARY KEY (unit_id, structure_id);


--
-- Name: unit_structure_application_vote unit_structure_application_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application_vote
    ADD CONSTRAINT unit_structure_application_vote_pkey PRIMARY KEY (unit_id, structure_id, profile_id);


--
-- Name: unit_structure_application_vote_stat unit_structure_application_vote_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application_vote_stat
    ADD CONSTRAINT unit_structure_application_vote_stat_pkey PRIMARY KEY (unit_id, structure_id);


--
-- Name: unit_structure unit_structure_definition_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure
    ADD CONSTRAINT unit_structure_definition_key UNIQUE (kind, definition_version, member_unit_ids);


--
-- Name: unit_structure_edge unit_structure_edge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_edge
    ADD CONSTRAINT unit_structure_edge_pkey PRIMARY KEY (structure_id, ordinal);


--
-- Name: unit_structure_member unit_structure_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_member
    ADD CONSTRAINT unit_structure_member_pkey PRIMARY KEY (structure_id, ordinal);


--
-- Name: unit_structure_member unit_structure_member_structure_member_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_member
    ADD CONSTRAINT unit_structure_member_structure_member_key UNIQUE (structure_id, member_unit_id);


--
-- Name: unit_structure unit_structure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure
    ADD CONSTRAINT unit_structure_pkey PRIMARY KEY (id);


--
-- Name: unit_structure_vote unit_structure_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_vote
    ADD CONSTRAINT unit_structure_vote_pkey PRIMARY KEY (structure_id, profile_id);


--
-- Name: unit_structure_vote_stat unit_structure_vote_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_vote_stat
    ADD CONSTRAINT unit_structure_vote_stat_pkey PRIMARY KEY (structure_id);


--
-- Name: unit_tag unit_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag
    ADD CONSTRAINT unit_tag_pkey PRIMARY KEY (unit_id, tag_id);


--
-- Name: unit_tag_structure_support unit_tag_structure_support_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_structure_support
    ADD CONSTRAINT unit_tag_structure_support_pkey PRIMARY KEY (unit_id, tag_id, profile_id, structure_id);


--
-- Name: unit_tag_vote unit_tag_vote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_vote
    ADD CONSTRAINT unit_tag_vote_pkey PRIMARY KEY (unit_id, tag_id, profile_id);


--
-- Name: unit_tag_vote_stat unit_tag_vote_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_vote_stat
    ADD CONSTRAINT unit_tag_vote_stat_pkey PRIMARY KEY (unit_id, tag_id);


--
-- Name: unit_variant unit_variant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_variant
    ADD CONSTRAINT unit_variant_pkey PRIMARY KEY (variant_unit_id);


--
-- Name: user_account_state user_account_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_account_state
    ADD CONSTRAINT user_account_state_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: video video_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video
    ADD CONSTRAINT video_pkey PRIMARY KEY (id);


--
-- Name: zone_page zone_page_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_page
    ADD CONSTRAINT zone_page_pkey PRIMARY KEY (id);


--
-- Name: zone zone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone
    ADD CONSTRAINT zone_pkey PRIMARY KEY (id);


--
-- Name: zone_search_feature zone_search_feature_document_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_search_feature
    ADD CONSTRAINT zone_search_feature_document_key UNIQUE (search_document_id);


--
-- Name: zone_search_feature zone_search_feature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_search_feature
    ADD CONSTRAINT zone_search_feature_pkey PRIMARY KEY (zone_id);


--
-- Name: account_enforcement_profile_kind_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_enforcement_profile_kind_expiry_idx ON public.account_enforcement USING btree (profile_id, kind, expires_at);


--
-- Name: account_enforcement_revocation_action_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_enforcement_revocation_action_key ON public.account_enforcement USING btree (revocation_action_id) WHERE (revocation_action_id IS NOT NULL);


--
-- Name: accounts_provider_id_account_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accounts_provider_id_account_id_key ON public.accounts USING btree (provider_id, account_id);


--
-- Name: accounts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_user_id_idx ON public.accounts USING btree (user_id);


--
-- Name: api_account_quota_binding_assigned_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_account_quota_binding_assigned_by_idx ON public.api_account_quota_binding USING btree (assigned_by_profile_id);


--
-- Name: api_account_quota_binding_policy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_account_quota_binding_policy_idx ON public.api_account_quota_binding USING btree (policy_id);


--
-- Name: api_quota_daily_usage_account_scope_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_quota_daily_usage_account_scope_date_key ON public.api_quota_daily_usage USING btree (account_user_id, scope, usage_date) WHERE (account_user_id IS NOT NULL);


--
-- Name: api_quota_daily_usage_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_quota_daily_usage_date_idx ON public.api_quota_daily_usage USING btree (usage_date);


--
-- Name: api_quota_daily_usage_token_scope_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_quota_daily_usage_token_scope_date_key ON public.api_quota_daily_usage USING btree (token_id, scope, usage_date) WHERE (token_id IS NOT NULL);


--
-- Name: api_quota_policy_id_subject_kind_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_quota_policy_id_subject_kind_key ON public.api_quota_policy USING btree (id, subject_kind);


--
-- Name: api_quota_policy_revision_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_quota_policy_revision_created_by_idx ON public.api_quota_policy_revision USING btree (created_by_profile_id);


--
-- Name: api_quota_rate_state_account_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_quota_rate_state_account_scope_key ON public.api_quota_rate_state USING btree (account_user_id, scope) WHERE (account_user_id IS NOT NULL);


--
-- Name: api_quota_rate_state_token_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_quota_rate_state_token_scope_key ON public.api_quota_rate_state USING btree (token_id, scope) WHERE (token_id IS NOT NULL);


--
-- Name: api_quota_rate_state_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_quota_rate_state_updated_at_idx ON public.api_quota_rate_state USING btree (updated_at);


--
-- Name: api_quota_request_lease_account_request_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_quota_request_lease_account_request_scope_key ON public.api_quota_request_lease USING btree (account_user_id, request_id, scope) WHERE (account_user_id IS NOT NULL);


--
-- Name: api_quota_request_lease_account_scope_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_quota_request_lease_account_scope_expiry_idx ON public.api_quota_request_lease USING btree (account_user_id, scope, expires_at) WHERE (account_user_id IS NOT NULL);


--
-- Name: api_quota_request_lease_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_quota_request_lease_expiry_idx ON public.api_quota_request_lease USING btree (expires_at);


--
-- Name: api_quota_request_lease_token_request_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_quota_request_lease_token_request_scope_key ON public.api_quota_request_lease USING btree (token_id, request_id, scope) WHERE (token_id IS NOT NULL);


--
-- Name: api_quota_request_lease_token_scope_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_quota_request_lease_token_scope_expiry_idx ON public.api_quota_request_lease USING btree (token_id, scope, expires_at) WHERE (token_id IS NOT NULL);


--
-- Name: api_token_creation_reservation_account_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_token_creation_reservation_account_expiry_idx ON public.api_token_creation_reservation USING btree (account_user_id, expires_at);


--
-- Name: api_token_creation_reservation_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_token_creation_reservation_expiry_idx ON public.api_token_creation_reservation USING btree (expires_at);


--
-- Name: api_token_quota_binding_assigned_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_token_quota_binding_assigned_by_idx ON public.api_token_quota_binding USING btree (assigned_by_profile_id);


--
-- Name: api_token_quota_binding_policy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_token_quota_binding_policy_idx ON public.api_token_quota_binding USING btree (policy_id);


--
-- Name: api_token_quota_override_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_token_quota_override_updated_by_idx ON public.api_token_quota_override USING btree (updated_by_profile_id);


--
-- Name: apikeys_config_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apikeys_config_id_idx ON public.apikeys USING btree (config_id);


--
-- Name: apikeys_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX apikeys_key_key ON public.apikeys USING btree (key);


--
-- Name: apikeys_reference_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apikeys_reference_id_idx ON public.apikeys USING btree (reference_id);


--
-- Name: audit_event_action_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_event_action_created_at_idx ON public.audit_event USING btree (action, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: audit_event_actor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_event_actor_created_at_idx ON public.audit_event USING btree (actor_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: audit_event_authority_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_event_authority_created_at_idx ON public.audit_event USING btree (authority_kind, authority_id, created_at DESC NULLS LAST);


--
-- Name: audit_event_category_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_event_category_created_at_idx ON public.audit_event USING btree (category, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: audit_event_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_event_request_idx ON public.audit_event USING btree (request_id);


--
-- Name: audit_event_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_event_target_idx ON public.audit_event USING btree (target_kind, target_id);


--
-- Name: audit_event_trace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_event_trace_idx ON public.audit_event USING btree (trace_id);


--
-- Name: book_isbn13_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX book_isbn13_key ON public.book USING btree (isbn13) WHERE (isbn13 IS NOT NULL);


--
-- Name: book_publication_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_publication_date_idx ON public.book USING btree (publication_date);


--
-- Name: collection_item_added_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_item_added_by_idx ON public.collection_item USING btree (added_by_profile_id);


--
-- Name: collection_item_collection_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_item_collection_position_idx ON public.collection_item USING btree (collection_id, "position", unit_id);


--
-- Name: collection_item_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_item_unit_idx ON public.collection_item USING btree (unit_id);


--
-- Name: collection_structure_revision_actor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_structure_revision_actor_created_at_idx ON public.collection_structure_revision USING btree (actor_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: collection_structure_revision_collection_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_structure_revision_collection_created_at_idx ON public.collection_structure_revision USING btree (collection_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: collection_structure_revision_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_structure_revision_content_idx ON public.collection_structure_revision USING btree (content_id);


--
-- Name: collection_structure_revision_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_structure_revision_parent_idx ON public.collection_structure_revision USING btree (parent_revision_id);


--
-- Name: collection_structure_revision_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_structure_revision_source_idx ON public.collection_structure_revision USING btree (source_revision_id);


--
-- Name: content_structure_node_content_unit_structure_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_node_content_unit_structure_idx ON public.content_structure_node USING btree (content_unit_id, structure_id) WHERE (deleted_at IS NULL);


--
-- Name: content_structure_node_document_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX content_structure_node_document_key ON public.content_structure_node USING btree (structure_id, document_key) WHERE ((document_key IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: content_structure_node_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_node_owner_idx ON public.content_structure_node USING btree (owner_unit_id, structure_id) WHERE (deleted_at IS NULL);


--
-- Name: content_structure_node_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_node_parent_idx ON public.content_structure_node USING btree (parent_id);


--
-- Name: content_structure_node_progress_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_node_progress_node_idx ON public.content_structure_node_progress USING btree (node_id);


--
-- Name: content_structure_node_structure_parent_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_node_structure_parent_position_idx ON public.content_structure_node USING btree (structure_id, parent_id, "position", id) WHERE (deleted_at IS NULL);


--
-- Name: content_structure_node_target_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_node_target_unit_idx ON public.content_structure_node USING btree (target_unit_id);


--
-- Name: content_structure_owner_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_owner_kind_idx ON public.content_structure USING btree (owner_unit_id, kind, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: content_structure_revision_actor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_revision_actor_created_at_idx ON public.content_structure_revision USING btree (actor_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: content_structure_revision_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_revision_content_idx ON public.content_structure_revision USING btree (content_id);


--
-- Name: content_structure_revision_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_revision_parent_idx ON public.content_structure_revision USING btree (parent_revision_id);


--
-- Name: content_structure_revision_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_revision_source_idx ON public.content_structure_revision USING btree (source_revision_id);


--
-- Name: content_structure_revision_structure_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_structure_revision_structure_created_at_idx ON public.content_structure_revision USING btree (structure_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: content_structure_singleton_kind_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX content_structure_singleton_kind_key ON public.content_structure USING btree (owner_unit_id, kind) WHERE ((deleted_at IS NULL) AND (kind = ANY (ARRAY['book.contents'::text, 'media.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'page-structure'::text])));


--
-- Name: conversation_high_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_high_profile_idx ON public.conversation USING btree (participant_high_profile_id);


--
-- Name: conversation_low_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_low_profile_idx ON public.conversation USING btree (participant_low_profile_id);


--
-- Name: conversation_participant_stat_last_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participant_stat_last_message_idx ON public.conversation_participant_stat USING btree (last_message_id);


--
-- Name: conversation_participant_stat_profile_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participant_stat_profile_sort_idx ON public.conversation_participant_stat USING btree (profile_id, sort_at DESC NULLS LAST, conversation_id DESC NULLS LAST);


--
-- Name: conversation_read_last_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_read_last_message_idx ON public.conversation_read USING btree (last_read_message_id);


--
-- Name: conversation_read_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_read_profile_idx ON public.conversation_read USING btree (profile_id);


--
-- Name: conversation_stat_last_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_stat_last_message_idx ON public.conversation_stat USING btree (last_message_id);


--
-- Name: credit_attribution_credited_unit_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_attribution_credited_unit_role_idx ON public.credit_attribution USING btree (credited_unit_id, role);


--
-- Name: credit_attribution_source_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_attribution_source_position_idx ON public.credit_attribution USING btree (source_unit_id, "position", id);


--
-- Name: dock_revision_actor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dock_revision_actor_created_at_idx ON public.dock_revision USING btree (actor_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: dock_revision_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dock_revision_content_idx ON public.dock_revision USING btree (content_id);


--
-- Name: dock_revision_dock_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dock_revision_dock_created_at_idx ON public.dock_revision USING btree (dock_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: email_outbox_notification_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_outbox_notification_idx ON public.email_outbox USING btree (notification_id) WHERE (notification_id IS NOT NULL);


--
-- Name: email_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_outbox_pending_idx ON public.email_outbox USING btree (available_at, created_at) WHERE (status = 'pending'::public.email_outbox_status);


--
-- Name: email_outbox_processing_lease_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_outbox_processing_lease_idx ON public.email_outbox USING btree (lease_expires_at) WHERE (status = 'processing'::public.email_outbox_status);


--
-- Name: email_outbox_provider_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_outbox_provider_message_idx ON public.email_outbox USING btree (provider_message_id) WHERE (provider_message_id IS NOT NULL);


--
-- Name: entity_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_kind_idx ON public.entity USING btree (kind);


--
-- Name: governance_post_binding_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX governance_post_binding_subject_idx ON public.governance_post_binding USING btree (subject_kind, subject_id);


--
-- Name: governance_post_binding_subject_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX governance_post_binding_subject_role_idx ON public.governance_post_binding USING btree (subject_kind, subject_id, role);


--
-- Name: image_asset_cleanup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_asset_cleanup_idx ON public.image_asset USING btree (status, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: image_asset_owner_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_asset_owner_status_idx ON public.image_asset USING btree (owner_profile_id, status, created_at);


--
-- Name: image_asset_uploader_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_asset_uploader_status_idx ON public.image_asset USING btree (uploader_profile_id, status, created_at);


--
-- Name: media_kind_release_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_kind_release_date_idx ON public.media USING btree (kind, release_date);


--
-- Name: message_conversation_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_conversation_created_at_idx ON public.message USING btree (conversation_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: message_sender_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_sender_created_at_idx ON public.message USING btree (sender_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: moderation_action_actor_case_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX moderation_action_actor_case_idempotency_key ON public.moderation_action USING btree (actor_profile_id, case_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: moderation_action_actor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_action_actor_created_at_idx ON public.moderation_action USING btree (actor_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: moderation_action_case_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_action_case_created_at_idx ON public.moderation_action USING btree (case_id, created_at, id);


--
-- Name: moderation_action_content_license_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_action_content_license_created_at_idx ON public.moderation_action USING btree (content_license_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: moderation_action_reverses_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_action_reverses_idx ON public.moderation_action USING btree (reverses_action_id);


--
-- Name: moderation_case_assignee_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_case_assignee_state_idx ON public.moderation_case USING btree (assigned_profile_id, state, created_at, id);


--
-- Name: moderation_case_authority_state_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_case_authority_state_created_idx ON public.moderation_case USING btree (authority, state, created_at, id);


--
-- Name: moderation_case_duplicate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_case_duplicate_idx ON public.moderation_case USING btree (duplicate_of_case_id);


--
-- Name: moderation_case_realm_state_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_case_realm_state_created_idx ON public.moderation_case USING btree (realm_id, state, created_at, id);


--
-- Name: moderation_case_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderation_case_target_idx ON public.moderation_case USING btree (target_kind, target_id);


--
-- Name: notification_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_actor_idx ON public.notification USING btree (actor_profile_id);


--
-- Name: notification_preference_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_preference_kind_idx ON public.notification_preference USING btree (kind);


--
-- Name: notification_recipient_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_recipient_created_at_idx ON public.notification USING btree (recipient_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE in_app_visible;


--
-- Name: notification_recipient_dedupe_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_recipient_dedupe_key ON public.notification USING btree (recipient_profile_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: notification_recipient_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_recipient_unread_idx ON public.notification USING btree (recipient_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (in_app_visible AND (read_at IS NULL));


--
-- Name: notification_subject_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_subject_unit_idx ON public.notification USING btree (subject_unit_id);


--
-- Name: platform_capability_grant_active_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX platform_capability_grant_active_key ON public.platform_capability_grant USING btree (profile_id, capability) WHERE (revoked_at IS NULL);


--
-- Name: platform_capability_grant_granted_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_capability_grant_granted_by_idx ON public.platform_capability_grant USING btree (granted_by_profile_id);


--
-- Name: platform_capability_grant_profile_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_capability_grant_profile_expiry_idx ON public.platform_capability_grant USING btree (profile_id, expires_at);


--
-- Name: platform_capability_grant_revoked_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_capability_grant_revoked_by_idx ON public.platform_capability_grant USING btree (revoked_by_profile_id);


--
-- Name: platform_unit_report_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_unit_report_case_idx ON public.platform_unit_report USING btree (case_id);


--
-- Name: platform_unit_report_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_unit_report_created_at_idx ON public.platform_unit_report USING btree (created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: platform_unit_report_reporter_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_unit_report_reporter_created_at_idx ON public.platform_unit_report USING btree (reporter_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: platform_unit_report_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_unit_report_rule_idx ON public.platform_unit_report USING btree (rule_id);


--
-- Name: platform_unit_report_unit_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_unit_report_unit_created_at_idx ON public.platform_unit_report USING btree (unit_id, created_at DESC NULLS LAST);


--
-- Name: poll_option_poll_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poll_option_poll_position_idx ON public.poll_option USING btree (poll_id, "position", id) WHERE (deleted_at IS NULL);


--
-- Name: poll_option_target_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poll_option_target_unit_idx ON public.poll_option USING btree (target_unit_id);


--
-- Name: poll_vote_option_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poll_vote_option_idx ON public.poll_vote USING btree (option_id);


--
-- Name: poll_vote_profile_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poll_vote_profile_created_at_idx ON public.poll_vote USING btree (profile_id, created_at DESC NULLS LAST, poll_id);


--
-- Name: poll_vote_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poll_vote_realm_idx ON public.poll_vote USING btree (realm_id);


--
-- Name: post_kind_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_kind_created_at_idx ON public.post USING btree (kind, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: post_progress_entry_progress_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_progress_entry_progress_entry_idx ON public.post_progress_entry USING btree (progress_entry_id);


--
-- Name: post_reply_parent_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_reply_parent_created_at_idx ON public.post_reply USING btree (parent_post_id, created_at, post_id);


--
-- Name: post_reply_root_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_reply_root_created_at_idx ON public.post_reply USING btree (root_post_id, created_at, post_id);


--
-- Name: post_score_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_score_score_idx ON public.post_score USING btree (score_id);


--
-- Name: post_subject_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_subject_created_at_idx ON public.post USING btree (subject_unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: profile_block_blocked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_block_blocked_idx ON public.profile_block USING btree (blocked_profile_id);


--
-- Name: profile_preference_default_score_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_preference_default_score_realm_idx ON public.profile_preference USING btree (default_score_realm_id);


--
-- Name: profile_realm_tag_subscription_profile_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_realm_tag_subscription_profile_position_idx ON public.profile_realm_tag_subscription USING btree (profile_id, "position", realm_id);


--
-- Name: profile_realm_tag_subscription_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_realm_tag_subscription_realm_idx ON public.profile_realm_tag_subscription USING btree (realm_id, profile_id);


--
-- Name: profile_unit_tag_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_unit_tag_tag_idx ON public.profile_unit_tag USING btree (tag_id);


--
-- Name: profile_unit_tag_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_unit_tag_unit_idx ON public.profile_unit_tag USING btree (unit_id, profile_id);


--
-- Name: realm_member_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_member_profile_idx ON public.realm_member USING btree (profile_id);


--
-- Name: realm_member_realm_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_member_realm_state_idx ON public.realm_member USING btree (realm_id, state);


--
-- Name: realm_pin_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_pin_created_by_idx ON public.realm_pin USING btree (created_by_profile_id);


--
-- Name: realm_pin_realm_kind_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_pin_realm_kind_position_idx ON public.realm_pin USING btree (realm_id, kind, "position", unit_id);


--
-- Name: realm_pin_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_pin_unit_idx ON public.realm_pin USING btree (unit_id);


--
-- Name: realm_rule_acceptance_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_rule_acceptance_profile_idx ON public.realm_rule_acceptance USING btree (profile_id, accepted_at DESC NULLS LAST);


--
-- Name: realm_rule_revision_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_rule_revision_created_by_idx ON public.realm_rule_revision USING btree (created_by_profile_id);


--
-- Name: realm_rule_revision_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_rule_revision_position_idx ON public.realm_rule USING btree (revision_id, "position", id);


--
-- Name: realm_rule_revision_realm_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_rule_revision_realm_published_idx ON public.realm_rule_revision USING btree (realm_id, version DESC NULLS LAST);


--
-- Name: realm_score_context_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_score_context_post_idx ON public.realm_score_context USING btree (context_post_id);


--
-- Name: realm_tag_context_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_tag_context_post_idx ON public.realm_tag_context USING btree (context_post_id);


--
-- Name: realm_tag_context_post_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX realm_tag_context_post_unique ON public.realm_tag_context USING btree (context_post_id);


--
-- Name: realm_tag_context_tag_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_tag_context_tag_realm_idx ON public.realm_tag_context USING btree (tag_id, realm_id);


--
-- Name: realm_tag_vote_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_tag_vote_profile_idx ON public.realm_tag_vote USING btree (profile_id);


--
-- Name: realm_tag_vote_realm_tag_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_tag_vote_realm_tag_unit_idx ON public.realm_tag_vote USING btree (realm_id, tag_id, unit_id);


--
-- Name: realm_tag_vote_stat_realm_tag_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_tag_vote_stat_realm_tag_unit_idx ON public.realm_tag_vote_stat USING btree (realm_id, tag_id, unit_id);


--
-- Name: realm_unit_moderation_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_moderation_queue_idx ON public.realm_unit USING btree (realm_id, publication_state, status, updated_at DESC NULLS LAST, unit_id DESC NULLS LAST);


--
-- Name: realm_unit_publication_event_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_publication_event_actor_idx ON public.realm_unit_publication_event USING btree (changed_by_profile_id);


--
-- Name: realm_unit_publication_event_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_publication_event_history_idx ON public.realm_unit_publication_event USING btree (unit_id, realm_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: realm_unit_realm_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_realm_status_created_idx ON public.realm_unit USING btree (realm_id, publication_state, status, created_at DESC NULLS LAST, unit_id);


--
-- Name: realm_unit_report_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_report_case_idx ON public.realm_unit_report USING btree (case_id);


--
-- Name: realm_unit_report_realm_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_report_realm_created_at_idx ON public.realm_unit_report USING btree (realm_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: realm_unit_report_realm_unit_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_report_realm_unit_created_at_idx ON public.realm_unit_report USING btree (realm_id, unit_id, created_at DESC NULLS LAST);


--
-- Name: realm_unit_report_reporter_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_report_reporter_created_at_idx ON public.realm_unit_report USING btree (reporter_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: realm_unit_report_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_report_rule_idx ON public.realm_unit_report USING btree (rule_id);


--
-- Name: realm_unit_report_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_report_unit_idx ON public.realm_unit_report USING btree (unit_id);


--
-- Name: realm_unit_status_event_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_status_event_actor_idx ON public.realm_unit_status_event USING btree (changed_by_profile_id);


--
-- Name: realm_unit_status_event_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_status_event_history_idx ON public.realm_unit_status_event USING btree (realm_id, unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: realm_unit_tag_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_tag_tag_idx ON public.realm_unit_tag USING btree (realm_id, tag_id, unit_id);


--
-- Name: realm_unit_unit_publication_status_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX realm_unit_unit_publication_status_updated_idx ON public.realm_unit USING btree (unit_id, publication_state, status, updated_at DESC NULLS LAST, realm_id DESC NULLS LAST);


--
-- Name: recommendation_event_occurred_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_event_occurred_at_idx ON public.recommendation_event USING btree (occurred_at, id);


--
-- Name: recommendation_event_profile_occurred_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_event_profile_occurred_at_idx ON public.recommendation_event USING btree (profile_id, occurred_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: recommendation_event_target_occurred_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_event_target_occurred_at_idx ON public.recommendation_event USING btree (target_unit_id, occurred_at DESC NULLS LAST);


--
-- Name: recommendation_exclusion_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_exclusion_unit_idx ON public.recommendation_exclusion USING btree (unit_id, profile_id);


--
-- Name: recommendation_profile_interest_profile_rank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_profile_interest_profile_rank_idx ON public.recommendation_profile_interest USING btree (snapshot_id, profile_id, rank);


--
-- Name: recommendation_profile_signal_hourly_bucket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_profile_signal_hourly_bucket_idx ON public.recommendation_profile_signal_hourly USING btree (bucket_start, profile_id);


--
-- Name: recommendation_snapshot_active_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recommendation_snapshot_active_key ON public.recommendation_snapshot USING btree (active) WHERE active;


--
-- Name: recommendation_snapshot_state_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_snapshot_state_started_at_idx ON public.recommendation_snapshot USING btree (state, started_at DESC NULLS LAST);


--
-- Name: recommendation_unit_edge_source_rank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_edge_source_rank_idx ON public.recommendation_unit_edge USING btree (snapshot_id, source_unit_id, rank);


--
-- Name: recommendation_unit_edge_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_edge_target_idx ON public.recommendation_unit_edge USING btree (snapshot_id, target_unit_id);


--
-- Name: recommendation_unit_signal_hourly_bucket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_signal_hourly_bucket_idx ON public.recommendation_unit_signal_hourly USING btree (bucket_start, unit_id);


--
-- Name: recommendation_unit_stat_snapshot_best_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_stat_snapshot_best_idx ON public.recommendation_unit_stat USING btree (snapshot_id, best_score DESC NULLS LAST, unit_created_at DESC NULLS LAST, unit_id DESC NULLS LAST) WHERE (context_realm_id IS NULL);


--
-- Name: recommendation_unit_stat_snapshot_hot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_stat_snapshot_hot_idx ON public.recommendation_unit_stat USING btree (snapshot_id, hot_score DESC NULLS LAST, unit_created_at DESC NULLS LAST, unit_id DESC NULLS LAST) WHERE (context_realm_id IS NULL);


--
-- Name: recommendation_unit_stat_snapshot_rising_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_stat_snapshot_rising_idx ON public.recommendation_unit_stat USING btree (snapshot_id, rising_score DESC NULLS LAST, unit_created_at DESC NULLS LAST, unit_id DESC NULLS LAST) WHERE (context_realm_id IS NULL);


--
-- Name: recommendation_unit_stat_snapshot_top_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_stat_snapshot_top_idx ON public.recommendation_unit_stat USING btree (snapshot_id, top_score DESC NULLS LAST, unit_created_at DESC NULLS LAST, unit_id DESC NULLS LAST) WHERE (context_realm_id IS NULL);


--
-- Name: recommendation_unit_stat_snapshot_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recommendation_unit_stat_snapshot_unit_idx ON public.recommendation_unit_stat USING btree (snapshot_id, unit_id);


--
-- Name: release_parent_released_on_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX release_parent_released_on_idx ON public.release USING btree (parent_unit_id, released_on, id);


--
-- Name: score_public_profile_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX score_public_profile_updated_at_idx ON public.score USING btree (profile_id, updated_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (visibility = 'public'::public.resource_visibility);


--
-- Name: score_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX score_realm_idx ON public.score USING btree (realm_id);


--
-- Name: score_stat_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX score_stat_realm_idx ON public.score_stat USING btree (realm_id, unit_id);


--
-- Name: score_unit_realm_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX score_unit_realm_value_idx ON public.score USING btree (unit_id, realm_id, value);


--
-- Name: search_document_revision_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_document_revision_content_idx ON public.search_document_revision USING btree (content_id);


--
-- Name: search_document_revision_document_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_document_revision_document_created_at_idx ON public.search_document_revision USING btree (search_document_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: series_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX series_kind_idx ON public.series USING btree (kind);


--
-- Name: series_release_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX series_release_position_idx ON public.series_release USING btree (series_id, "position", release_unit_id);


--
-- Name: series_release_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX series_release_unit_idx ON public.series_release USING btree (release_unit_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: software_requirement_platform_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX software_requirement_platform_idx ON public.software_requirement USING btree (platform_entity_id);


--
-- Name: software_requirement_source_link_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX software_requirement_source_link_idx ON public.software_requirement USING btree (source_link_id);


--
-- Name: studio_resource_visit_profile_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_resource_visit_profile_recent_idx ON public.studio_resource_visit USING btree (profile_id, last_visited_at DESC NULLS LAST, resource_unit_id DESC NULLS LAST);


--
-- Name: studio_work_relation_identity_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX studio_work_relation_identity_key ON public.studio_work_relation USING btree (profile_id, resource_unit_id, authorization_unit_id, authorization_scope_key, relation, source);


--
-- Name: studio_work_relation_profile_relation_last_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_work_relation_profile_relation_last_idx ON public.studio_work_relation USING btree (profile_id, relation, last_at DESC NULLS LAST, resource_unit_id DESC NULLS LAST);


--
-- Name: studio_work_relation_profile_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX studio_work_relation_profile_resource_idx ON public.studio_work_relation USING btree (profile_id, resource_unit_id);


--
-- Name: subject_association_context_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subject_association_context_post_idx ON public.subject_association USING btree (context_post_id) WHERE (context_post_id IS NOT NULL);


--
-- Name: subject_association_entity_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subject_association_entity_role_idx ON public.subject_association USING btree (entity_id, role);


--
-- Name: subject_association_unit_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subject_association_unit_position_idx ON public.subject_association USING btree (unit_id, "position", id);


--
-- Name: unit_access_grant_active_authenticated_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_access_grant_active_authenticated_scope_key ON public.unit_access_grant USING btree (unit_id, permission, scope) WHERE ((revoked_at IS NULL) AND (subject_kind = 'authenticated'::public.unit_access_subject_kind));


--
-- Name: unit_access_grant_active_profile_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_access_grant_active_profile_scope_key ON public.unit_access_grant USING btree (unit_id, profile_id, permission, scope) WHERE ((revoked_at IS NULL) AND (subject_kind = 'profile'::public.unit_access_subject_kind));


--
-- Name: unit_access_grant_active_realm_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_access_grant_active_realm_scope_key ON public.unit_access_grant USING btree (unit_id, realm_id, realm_relation, permission, scope) WHERE ((revoked_at IS NULL) AND (subject_kind = 'realm'::public.unit_access_subject_kind));


--
-- Name: unit_access_grant_granted_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_grant_granted_by_idx ON public.unit_access_grant USING btree (granted_by_profile_id);


--
-- Name: unit_access_grant_profile_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_grant_profile_active_idx ON public.unit_access_grant USING btree (profile_id, unit_id, permission) WHERE (revoked_at IS NULL);


--
-- Name: unit_access_grant_realm_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_grant_realm_active_idx ON public.unit_access_grant USING btree (realm_id, unit_id, permission) WHERE (revoked_at IS NULL);


--
-- Name: unit_access_grant_unit_transfer_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_grant_unit_transfer_candidate_idx ON public.unit_access_grant USING btree (unit_id, permission, profile_id) WHERE ((revoked_at IS NULL) AND (expires_at IS NULL) AND (subject_kind = 'profile'::public.unit_access_subject_kind) AND (cardinality(scope) = 0));


--
-- Name: unit_access_invitation_invited_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_invitation_invited_by_idx ON public.unit_access_invitation USING btree (invited_by_profile_id);


--
-- Name: unit_access_invitation_profile_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_invitation_profile_unresolved_idx ON public.unit_access_invitation USING btree (invited_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (resolution IS NULL);


--
-- Name: unit_access_invitation_resolved_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_invitation_resolved_by_idx ON public.unit_access_invitation USING btree (resolved_by_profile_id);


--
-- Name: unit_access_invitation_unit_transfer_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_invitation_unit_transfer_candidate_idx ON public.unit_access_invitation USING btree (unit_id, invited_profile_id) WHERE ((resolution = 'accepted'::public.unit_access_invitation_resolution) AND (access_expires_at IS NULL) AND (cardinality(scope) = 0));


--
-- Name: unit_access_invitation_unit_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_invitation_unit_unresolved_idx ON public.unit_access_invitation USING btree (unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (resolution IS NULL);


--
-- Name: unit_access_restriction_active_profile_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_access_restriction_active_profile_scope_key ON public.unit_access_restriction USING btree (unit_id, profile_id, permission, scope) WHERE ((revoked_at IS NULL) AND (subject_kind = 'profile'::public.unit_access_restriction_subject_kind));


--
-- Name: unit_access_restriction_active_realm_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_access_restriction_active_realm_scope_key ON public.unit_access_restriction USING btree (unit_id, realm_id, realm_relation, permission, scope) WHERE ((revoked_at IS NULL) AND (subject_kind = 'realm'::public.unit_access_restriction_subject_kind));


--
-- Name: unit_access_restriction_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_restriction_created_by_idx ON public.unit_access_restriction USING btree (created_by_profile_id);


--
-- Name: unit_access_restriction_profile_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_restriction_profile_active_idx ON public.unit_access_restriction USING btree (profile_id, unit_id, permission) WHERE ((revoked_at IS NULL) AND (subject_kind = 'profile'::public.unit_access_restriction_subject_kind));


--
-- Name: unit_access_restriction_realm_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_access_restriction_realm_active_idx ON public.unit_access_restriction USING btree (realm_id, unit_id, permission) WHERE ((revoked_at IS NULL) AND (subject_kind = 'realm'::public.unit_access_restriction_subject_kind));


--
-- Name: unit_alias_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_alias_created_by_idx ON public.unit_alias USING btree (created_by_profile_id);


--
-- Name: unit_alias_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_alias_normalized_idx ON public.unit_alias USING btree (normalized_term);


--
-- Name: unit_alias_term_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_alias_term_search_idx ON public.unit_alias USING pgroonga (term);


--
-- Name: unit_alias_unit_pinned_position_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_alias_unit_pinned_position_unique ON public.unit_alias USING btree (unit_id, "position") WHERE pinned;


--
-- Name: unit_alias_unit_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_alias_unit_position_idx ON public.unit_alias USING btree (unit_id, pinned, "position", id);


--
-- Name: unit_alias_vote_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_alias_vote_profile_idx ON public.unit_alias_vote USING btree (profile_id);


--
-- Name: unit_association_proposal_context_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_association_proposal_context_post_idx ON public.unit_association_proposal USING btree (context_post_id) WHERE (context_post_id IS NOT NULL);


--
-- Name: unit_association_proposal_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_association_proposal_created_by_idx ON public.unit_association_proposal USING btree (created_by_profile_id);


--
-- Name: unit_association_proposal_resolved_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_association_proposal_resolved_by_idx ON public.unit_association_proposal USING btree (resolved_by_profile_id);


--
-- Name: unit_association_proposal_source_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_association_proposal_source_unresolved_idx ON public.unit_association_proposal USING btree (source_unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (resolution IS NULL);


--
-- Name: unit_association_proposal_target_unresolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_association_proposal_target_unresolved_idx ON public.unit_association_proposal USING btree (target_unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (resolution IS NULL);


--
-- Name: unit_content_license_active_unit_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_content_license_active_unit_key ON public.unit_content_license USING btree (unit_id) WHERE (status = 'active'::public.unit_content_license_status);


--
-- Name: unit_content_license_granted_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_content_license_granted_by_idx ON public.unit_content_license USING btree (granted_by_profile_id);


--
-- Name: unit_content_license_reference_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_content_license_reference_slug_idx ON public.unit_content_license USING btree (reference_license_slug);


--
-- Name: unit_content_license_unit_granted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_content_license_unit_granted_at_idx ON public.unit_content_license USING btree (unit_id, granted_at DESC NULLS LAST);


--
-- Name: unit_effective_tag_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_effective_tag_tag_idx ON public.unit_effective_tag USING btree (tag_id, unit_id);


--
-- Name: unit_effective_tag_vote_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_effective_tag_vote_profile_idx ON public.unit_effective_tag_vote USING btree (profile_id, unit_id);


--
-- Name: unit_follow_follower_favorite_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_follow_follower_favorite_position_idx ON public.unit_follow USING btree (follower_profile_id, favorite DESC NULLS LAST, "position", unit_id);


--
-- Name: unit_follow_notification_preference_enabled_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_follow_notification_preference_enabled_unit_idx ON public.unit_follow_notification_preference USING btree (unit_id, follower_profile_id) WHERE in_app;


--
-- Name: unit_follow_unit_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_follow_unit_created_at_idx ON public.unit_follow USING btree (unit_id, created_at DESC NULLS LAST, follower_profile_id);


--
-- Name: unit_kind_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_kind_status_created_at_idx ON public.unit USING btree (kind, status, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (deleted_at IS NULL);


--
-- Name: unit_localization_content_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_localization_content_status_idx ON public.unit_localization USING btree (content_status, updated_at);


--
-- Name: unit_localization_language_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_localization_language_unit_idx ON public.unit_localization USING btree (language, unit_id);


--
-- Name: unit_localization_pgroonga_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_localization_pgroonga_content_idx ON public.unit_localization USING pgroonga (public.current_search_text_v1(content)) WITH (lexicon_flags_mapping='{"current_search_text_v1":["LARGE"]}', index_flags_mapping='{"current_search_text_v1":["LARGE"]}');


--
-- Name: unit_localization_pgroonga_metadata_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_localization_pgroonga_metadata_idx ON public.unit_localization USING pgroonga (public.current_search_metadata_v1(title, summary, description)) WITH (lexicon_flags_mapping='{"current_search_metadata_v1":["LARGE"]}', index_flags_mapping='{"current_search_metadata_v1":["LARGE"]}');


--
-- Name: unit_localization_unit_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_localization_unit_position_idx ON public.unit_localization USING btree (unit_id, "position", language);


--
-- Name: unit_moderation_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_moderation_status_idx ON public.unit USING btree (moderation_status);


--
-- Name: unit_ownership_active_unit_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_ownership_active_unit_key ON public.unit_ownership USING btree (unit_id) WHERE (revoked_at IS NULL);


--
-- Name: unit_ownership_assigned_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_ownership_assigned_by_idx ON public.unit_ownership USING btree (assigned_by_profile_id);


--
-- Name: unit_ownership_claim_claimant_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_ownership_claim_claimant_created_at_idx ON public.unit_ownership_claim USING btree (claimant_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: unit_ownership_claim_pending_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_ownership_claim_pending_created_at_idx ON public.unit_ownership_claim USING btree (created_at, id) WHERE (resolution IS NULL);


--
-- Name: unit_ownership_claim_pending_profile_unit_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_ownership_claim_pending_profile_unit_key ON public.unit_ownership_claim USING btree (unit_id, claimant_profile_id) WHERE (resolution IS NULL);


--
-- Name: unit_ownership_claim_resulting_ownership_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_ownership_claim_resulting_ownership_key ON public.unit_ownership_claim USING btree (resulting_ownership_id) WHERE (resulting_ownership_id IS NOT NULL);


--
-- Name: unit_ownership_claim_source_ownership_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_ownership_claim_source_ownership_idx ON public.unit_ownership_claim USING btree (source_ownership_id);


--
-- Name: unit_ownership_claim_unit_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_ownership_claim_unit_created_at_idx ON public.unit_ownership_claim USING btree (unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: unit_ownership_profile_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_ownership_profile_active_idx ON public.unit_ownership USING btree (profile_id, unit_id) WHERE (revoked_at IS NULL);


--
-- Name: unit_ownership_revoked_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_ownership_revoked_by_idx ON public.unit_ownership USING btree (revoked_by_profile_id);


--
-- Name: unit_progress_current_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_current_entry_idx ON public.unit_progress USING btree (current_entry_id);


--
-- Name: unit_progress_entry_content_structure_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_entry_content_structure_node_idx ON public.unit_progress_entry USING btree (content_structure_node_id);


--
-- Name: unit_progress_entry_content_structure_revision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_entry_content_structure_revision_idx ON public.unit_progress_entry USING btree (content_structure_revision_id);


--
-- Name: unit_progress_entry_profile_unit_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_entry_profile_unit_created_idx ON public.unit_progress_entry USING btree (profile_id, unit_id, created_at DESC NULLS LAST) WHERE (deleted_at IS NULL);


--
-- Name: unit_progress_entry_profile_unit_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_entry_profile_unit_sort_idx ON public.unit_progress_entry USING btree (profile_id, unit_id, COALESCE(occurred_at, created_at) DESC, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (deleted_at IS NULL);


--
-- Name: unit_progress_entry_profile_unit_status_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_entry_profile_unit_status_sort_idx ON public.unit_progress_entry USING btree (profile_id, unit_id, status, COALESCE(occurred_at, created_at) DESC, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (deleted_at IS NULL);


--
-- Name: unit_progress_entry_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_entry_unit_idx ON public.unit_progress_entry USING btree (unit_id);


--
-- Name: unit_progress_last_content_structure_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_last_content_structure_node_idx ON public.unit_progress USING btree (last_content_structure_node_id);


--
-- Name: unit_progress_profile_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_profile_seen_idx ON public.unit_progress USING btree (profile_id, last_seen_at DESC NULLS LAST, unit_id) WHERE (deleted_at IS NULL);


--
-- Name: unit_progress_public_profile_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_public_profile_seen_idx ON public.unit_progress USING btree (profile_id, last_seen_at DESC NULLS LAST, unit_id) WHERE ((deleted_at IS NULL) AND (visibility = 'public'::public.resource_visibility));


--
-- Name: unit_progress_unit_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_progress_unit_status_idx ON public.unit_progress USING btree (unit_id, status);


--
-- Name: unit_public_discoverable_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_public_discoverable_idx ON public.unit USING btree (id) WHERE ((status = 'published'::public.unit_status) AND (visibility = 'public'::public.resource_visibility) AND (moderation_status = 'approved'::public.moderation_status) AND (deleted_at IS NULL));


--
-- Name: unit_reaction_profile_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_reaction_profile_created_at_idx ON public.unit_reaction USING btree (profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: unit_reaction_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_reaction_realm_idx ON public.unit_reaction USING btree (realm_id);


--
-- Name: unit_reaction_stat_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_reaction_stat_realm_idx ON public.unit_reaction_stat USING btree (realm_id, unit_id);


--
-- Name: unit_reaction_unit_kind_realm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_reaction_unit_kind_realm_idx ON public.unit_reaction USING btree (unit_id, reaction, realm_id);


--
-- Name: unit_revision_actor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_revision_actor_created_at_idx ON public.unit_revision USING btree (actor_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: unit_revision_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_revision_parent_idx ON public.unit_revision USING btree (parent_revision_id);


--
-- Name: unit_revision_slot_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_revision_slot_content_idx ON public.unit_revision_slot USING btree (content_id);


--
-- Name: unit_revision_slot_origin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_revision_slot_origin_idx ON public.unit_revision_slot USING btree (origin_revision_id);


--
-- Name: unit_revision_tag_tag_revision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_revision_tag_tag_revision_idx ON public.unit_revision_tag USING btree (tag, revision_id);


--
-- Name: unit_revision_unit_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_revision_unit_created_at_idx ON public.unit_revision USING btree (unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: unit_share_unit_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_share_unit_created_at_idx ON public.unit_share USING btree (unit_id, created_at DESC NULLS LAST, profile_id);


--
-- Name: unit_slug_address_target_canonical_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_slug_address_target_canonical_key ON public.unit_slug_address USING btree (target_unit_id) WHERE (kind = 'canonical'::text);


--
-- Name: unit_slug_address_target_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_slug_address_target_unit_idx ON public.unit_slug_address USING btree (target_unit_id);


--
-- Name: unit_source_link_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_source_link_created_by_idx ON public.unit_source_link USING btree (created_by_profile_id);


--
-- Name: unit_source_link_source_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_source_link_source_entity_idx ON public.unit_source_link USING btree (source_entity_id);


--
-- Name: unit_source_link_unit_pinned_position_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_source_link_unit_pinned_position_unique ON public.unit_source_link USING btree (unit_id, "position") WHERE pinned;


--
-- Name: unit_source_link_unit_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_source_link_unit_position_idx ON public.unit_source_link USING btree (unit_id, pinned, "position", id);


--
-- Name: unit_source_link_vote_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_source_link_vote_profile_idx ON public.unit_source_link_vote USING btree (profile_id);


--
-- Name: unit_status_event_actor_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_status_event_actor_created_at_idx ON public.unit_status_event USING btree (changed_by_profile_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: unit_status_event_publication_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_status_event_publication_idx ON public.unit_status_event USING btree (unit_id, to_status, created_at, id);


--
-- Name: unit_status_event_unit_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_status_event_unit_created_at_idx ON public.unit_status_event USING btree (unit_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: unit_status_visibility_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_status_visibility_created_at_idx ON public.unit USING btree (status, visibility, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (deleted_at IS NULL);


--
-- Name: unit_structure_application_structure_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_application_structure_idx ON public.unit_structure_application USING btree (structure_id, unit_id);


--
-- Name: unit_structure_application_unit_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_application_unit_position_idx ON public.unit_structure_application USING btree (unit_id, pinned, "position", structure_id);


--
-- Name: unit_structure_application_vote_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_application_vote_profile_idx ON public.unit_structure_application_vote USING btree (profile_id, unit_id);


--
-- Name: unit_structure_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_created_by_idx ON public.unit_structure USING btree (created_by_profile_id, created_at);


--
-- Name: unit_structure_edge_child_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_edge_child_idx ON public.unit_structure_edge USING btree (child_unit_id, parent_unit_id, structure_id);


--
-- Name: unit_structure_edge_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_edge_parent_idx ON public.unit_structure_edge USING btree (parent_unit_id, child_unit_id, structure_id);


--
-- Name: unit_structure_member_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_member_unit_idx ON public.unit_structure_member USING btree (member_unit_id, structure_id, ordinal);


--
-- Name: unit_structure_vote_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_structure_vote_profile_idx ON public.unit_structure_vote USING btree (profile_id, structure_id);


--
-- Name: unit_tag_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_tag_created_by_idx ON public.unit_tag USING btree (created_by_profile_id);


--
-- Name: unit_tag_structure_support_effective_vote_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_tag_structure_support_effective_vote_idx ON public.unit_tag_structure_support USING btree (unit_id, tag_id, profile_id);


--
-- Name: unit_tag_structure_support_structure_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_tag_structure_support_structure_idx ON public.unit_tag_structure_support USING btree (structure_id, unit_id, profile_id);


--
-- Name: unit_tag_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_tag_tag_idx ON public.unit_tag USING btree (tag_id);


--
-- Name: unit_tag_unit_pinned_position_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_tag_unit_pinned_position_unique ON public.unit_tag USING btree (unit_id, "position") WHERE pinned;


--
-- Name: unit_tag_unit_position_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_tag_unit_position_idx ON public.unit_tag USING btree (unit_id, pinned, "position", tag_id);


--
-- Name: unit_tag_vote_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_tag_vote_profile_idx ON public.unit_tag_vote USING btree (profile_id);


--
-- Name: unit_tag_vote_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_tag_vote_tag_idx ON public.unit_tag_vote USING btree (tag_id);


--
-- Name: unit_variant_main_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_variant_main_created_at_idx ON public.unit_variant USING btree (main_unit_id, created_at, variant_unit_id);


--
-- Name: user_account_state_state_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_account_state_state_expiry_idx ON public.user_account_state USING btree (state, expires_at);


--
-- Name: user_account_state_updated_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_account_state_updated_by_idx ON public.user_account_state USING btree (updated_by_profile_id);


--
-- Name: verifications_identifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_identifier_idx ON public.verifications USING btree (identifier);


--
-- Name: zone_page_zone_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zone_page_zone_created_idx ON public.zone_page USING btree (zone_id, created_at, id);


--
-- Name: audit_event audit_event_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_event_append_only BEFORE DELETE OR UPDATE ON public.audit_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();


--
-- Name: content_structure_node book_chapter_node_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_chapter_node_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF structure_id, content_unit_id, deleted_at ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_node();


--
-- Name: post book_chapter_post_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_chapter_post_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF kind ON public.post FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_post();


--
-- Name: content_structure_node_progress book_chapter_progress_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_chapter_progress_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF profile_id, node_id ON public.content_structure_node_progress FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_progress();


--
-- Name: content_structure book_chapter_structure_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_chapter_structure_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF kind, deleted_at ON public.content_structure FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_structure();


--
-- Name: unit book_chapter_unit_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_chapter_unit_stat_maintain AFTER UPDATE OF kind, status, visibility, deleted_at ON public.unit FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_unit();


--
-- Name: unit_localization_content_metric book_localized_metric_content_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_localized_metric_content_refresh AFTER INSERT OR DELETE OR UPDATE OF unit_id, language, word_count, character_count ON public.unit_localization_content_metric FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_localization();


--
-- Name: unit_localization book_localized_metric_localization_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_localized_metric_localization_refresh AFTER INSERT OR DELETE OR UPDATE OF unit_id, language, content_status ON public.unit_localization FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_localization();


--
-- Name: content_structure_node book_localized_metric_node_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_localized_metric_node_refresh AFTER INSERT OR DELETE OR UPDATE OF structure_id, owner_unit_id, content_unit_id, deleted_at ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_node();


--
-- Name: post book_localized_metric_post_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_localized_metric_post_refresh AFTER INSERT OR DELETE OR UPDATE OF kind ON public.post FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_content_unit();


--
-- Name: content_structure book_localized_metric_structure_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_localized_metric_structure_refresh AFTER INSERT OR DELETE OR UPDATE OF owner_unit_id, kind, deleted_at ON public.content_structure FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_structure();


--
-- Name: unit book_localized_metric_unit_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER book_localized_metric_unit_refresh AFTER UPDATE OF kind, status, visibility, deleted_at ON public.unit FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_content_unit();


--
-- Name: collection_item collection_item_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER collection_item_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF collection_id ON public.collection_item FOR EACH ROW EXECUTE FUNCTION public.maintain_collection_item_stat();


--
-- Name: collection collection_stat_initialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER collection_stat_initialize AFTER INSERT ON public.collection FOR EACH ROW EXECUTE FUNCTION public.initialize_collection_stat();


--
-- Name: content_structure_node content_structure_node_acyclic; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER content_structure_node_acyclic AFTER INSERT OR UPDATE ON public.content_structure_node DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION public.content_structure_node_reject_cycle();


--
-- Name: content_structure_node content_structure_node_realm_tag_query_strategy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER content_structure_node_realm_tag_query_strategy BEFORE INSERT OR UPDATE OF structure_id, content_unit_id, realm_tag_query_strategy, deleted_at ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_taxonomy_tag_query_strategy();


--
-- Name: conversation conversation_aggregate_identity_protect; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversation_aggregate_identity_protect BEFORE UPDATE ON public.conversation FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_aggregate_identity();


--
-- Name: conversation_read conversation_read_identity_protect; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversation_read_identity_protect BEFORE UPDATE ON public.conversation_read FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_read_identity();


--
-- Name: conversation conversation_stats_initialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversation_stats_initialize AFTER INSERT ON public.conversation FOR EACH ROW EXECUTE FUNCTION public.initialize_conversation_stats();


--
-- Name: collection_item favorite_item_stats_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER favorite_item_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.collection_item FOR EACH ROW EXECUTE FUNCTION public.maintain_favorite_item_stats();


--
-- Name: message message_aggregate_identity_protect; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER message_aggregate_identity_protect BEFORE UPDATE ON public.message FOR EACH ROW EXECUTE FUNCTION public.protect_message_aggregate_identity();


--
-- Name: message message_stats_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER message_stats_maintain AFTER INSERT OR DELETE OR UPDATE OF deleted_at ON public.message FOR EACH ROW EXECUTE FUNCTION public.maintain_message_stats();


--
-- Name: profile notification_recipient_stat_initialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notification_recipient_stat_initialize AFTER INSERT ON public.profile FOR EACH ROW EXECUTE FUNCTION public.initialize_notification_recipient_stat();


--
-- Name: notification notification_recipient_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notification_recipient_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF recipient_profile_id, in_app_visible, read_at ON public.notification FOR EACH ROW EXECUTE FUNCTION public.maintain_notification_recipient_stat();


--
-- Name: poll_option poll_option_vote_stat_initialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER poll_option_vote_stat_initialize AFTER INSERT ON public.poll_option FOR EACH ROW EXECUTE FUNCTION public.initialize_poll_option_vote_stat();


--
-- Name: poll_vote poll_option_vote_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER poll_option_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF option_id ON public.poll_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_poll_option_vote_stat();


--
-- Name: post post_association_context_kind_protect; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_association_context_kind_protect BEFORE UPDATE OF kind ON public.post FOR EACH ROW EXECUTE FUNCTION public.protect_association_context_post_kind();


--
-- Name: realm_unit post_realm_mount_targeting_enforce; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_realm_mount_targeting_enforce AFTER INSERT OR UPDATE OF realm_id, unit_id ON public.realm_unit FOR EACH ROW EXECUTE FUNCTION public.enforce_post_realm_mount_targeting();


--
-- Name: post post_realm_tag_context_kind; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_realm_tag_context_kind BEFORE UPDATE OF kind ON public.post FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_context_post_kind();


--
-- Name: post_reply post_reply_identity_protect; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_reply_identity_protect BEFORE UPDATE ON public.post_reply FOR EACH ROW EXECUTE FUNCTION public.protect_post_reply_identity();


--
-- Name: post post_reply_stat_initialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_reply_stat_initialize AFTER INSERT ON public.post FOR EACH ROW EXECUTE FUNCTION public.initialize_post_reply_stat();


--
-- Name: post_reply post_reply_stats_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_reply_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.post_reply FOR EACH ROW EXECUTE FUNCTION public.maintain_post_reply_stats();


--
-- Name: post_reply post_reply_targeting_enforce; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_reply_targeting_enforce AFTER INSERT OR UPDATE OF root_post_id, parent_post_id ON public.post_reply FOR EACH ROW EXECUTE FUNCTION public.enforce_post_reply_targeting();


--
-- Name: post post_subject_targeting_enforce; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_subject_targeting_enforce AFTER INSERT OR UPDATE OF subject_unit_id ON public.post FOR EACH ROW EXECUTE FUNCTION public.enforce_post_subject_targeting();


--
-- Name: realm_member realm_member_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_member_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF realm_id, state ON public.realm_member FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_member_stat();


--
-- Name: realm realm_stat_initialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_stat_initialize AFTER INSERT ON public.realm FOR EACH ROW EXECUTE FUNCTION public.initialize_realm_stat();


--
-- Name: realm_tag_context realm_tag_context_wiki_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_tag_context_wiki_post BEFORE INSERT OR UPDATE OF context_post_id ON public.realm_tag_context FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_tag_context_wiki_post();


--
-- Name: realm_tag_vote realm_tag_vote_realm_tag_voting_enabled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_tag_vote_realm_tag_voting_enabled BEFORE INSERT OR UPDATE ON public.realm_tag_vote FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_tag_voting_enabled();


--
-- Name: realm_tag_vote realm_tag_vote_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_tag_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.realm_tag_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_vote_stat();


--
-- Name: realm_unit realm_unit_moderation_stat_initialize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_unit_moderation_stat_initialize AFTER INSERT ON public.realm_unit FOR EACH ROW EXECUTE FUNCTION public.initialize_realm_unit_moderation_stat();


--
-- Name: moderation_case realm_unit_report_case_state_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_unit_report_case_state_maintain AFTER UPDATE OF state ON public.moderation_case FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_report_case_state();


--
-- Name: realm_unit_report realm_unit_report_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER realm_unit_report_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF case_id, realm_id, unit_id ON public.realm_unit_report FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_report_stat();


--
-- Name: recommendation_event recommendation_event_signals_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recommendation_event_signals_maintain AFTER INSERT OR UPDATE ON public.recommendation_event FOR EACH ROW EXECUTE FUNCTION public.maintain_recommendation_event_signals();


--
-- Name: unit reply_signals_remove_before_unit_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reply_signals_remove_before_unit_delete BEFORE DELETE ON public.unit FOR EACH ROW EXECUTE FUNCTION public.remove_reply_signals_before_unit_delete();


--
-- Name: unit reply_unit_state_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reply_unit_state_maintain AFTER UPDATE OF status, visibility, moderation_status, deleted_at ON public.unit FOR EACH ROW WHEN (((old.status IS DISTINCT FROM new.status) OR (old.visibility IS DISTINCT FROM new.visibility) OR (old.moderation_status IS DISTINCT FROM new.moderation_status) OR (old.deleted_at IS DISTINCT FROM new.deleted_at))) EXECUTE FUNCTION public.maintain_reply_unit_state();


--
-- Name: revision_content revision_content_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER revision_content_immutable BEFORE DELETE OR UPDATE ON public.revision_content FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();


--
-- Name: score score_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER score_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.score FOR EACH ROW EXECUTE FUNCTION public.maintain_score_stat();


--
-- Name: subject_association subject_association_wiki_context_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subject_association_wiki_context_post BEFORE INSERT OR UPDATE OF context_post_id ON public.subject_association FOR EACH ROW EXECUTE FUNCTION public.enforce_wiki_association_context_post();


--
-- Name: unit_alias_vote unit_alias_vote_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_alias_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_alias_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_alias_vote_stat();


--
-- Name: unit_association_proposal unit_association_proposal_wiki_context_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_association_proposal_wiki_context_post BEFORE INSERT OR UPDATE OF context_post_id, kind ON public.unit_association_proposal FOR EACH ROW EXECUTE FUNCTION public.enforce_wiki_association_context_post();


--
-- Name: unit_content_license unit_content_license_guard_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_content_license_guard_mutation BEFORE DELETE OR UPDATE ON public.unit_content_license FOR EACH ROW EXECUTE FUNCTION public.guard_unit_content_license_mutation();


--
-- Name: unit_follow unit_follow_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_follow_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_follow FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_follow_stat();


--
-- Name: unit_progress unit_progress_stats_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_progress_stats_maintain AFTER INSERT OR DELETE OR UPDATE OF profile_id, unit_id, status, last_seen_at, deleted_at ON public.unit_progress FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_progress_stats();


--
-- Name: unit_reaction unit_reaction_stats_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_reaction_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_reaction FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_reaction_stats();


--
-- Name: unit_revision unit_revision_identity_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_revision_identity_immutable BEFORE UPDATE ON public.unit_revision FOR EACH ROW EXECUTE FUNCTION public.protect_unit_revision_identity();


--
-- Name: unit_revision_slot unit_revision_slot_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_revision_slot_immutable BEFORE DELETE OR UPDATE ON public.unit_revision_slot FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();


--
-- Name: unit_revision_tag unit_revision_tag_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_revision_tag_immutable BEFORE DELETE OR UPDATE ON public.unit_revision_tag FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();


--
-- Name: unit_share unit_share_stats_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_share_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_share FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_share_stats();


--
-- Name: unit_source_link_vote unit_source_link_vote_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_source_link_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_source_link_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_source_link_vote_stat();


--
-- Name: unit_structure_application_vote unit_structure_application_vote_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_application_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_application_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_structure_application_vote_stat();


--
-- Name: unit_structure_application_vote unit_structure_application_vote_support_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_application_vote_support_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_application_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_structure_application_support();


--
-- Name: unit_structure_application_vote unit_structure_application_vote_tag_conflict; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_application_vote_tag_conflict BEFORE INSERT OR UPDATE ON public.unit_structure_application_vote FOR EACH ROW EXECUTE FUNCTION public.reject_conflicting_structure_application_vote();


--
-- Name: unit_structure unit_structure_definition_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_definition_immutable BEFORE DELETE OR UPDATE ON public.unit_structure FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_unit_structure();


--
-- Name: unit_structure unit_structure_definition_project; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_definition_project AFTER INSERT OR UPDATE ON public.unit_structure FOR EACH ROW EXECUTE FUNCTION public.project_unit_structure_definition();


--
-- Name: unit_structure unit_structure_definition_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_definition_validate BEFORE INSERT OR UPDATE ON public.unit_structure FOR EACH ROW EXECUTE FUNCTION public.prepare_unit_structure_definition();


--
-- Name: unit_structure_edge unit_structure_edge_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_edge_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_edge FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_unit_structure();


--
-- Name: unit_structure_member unit_structure_member_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_member_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_member FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_unit_structure();


--
-- Name: unit_structure_vote unit_structure_vote_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_structure_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_structure_vote_stat();


--
-- Name: unit_tag unit_tag_effective_context_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_tag_effective_context_maintain AFTER INSERT OR DELETE ON public.unit_tag FOR EACH ROW EXECUTE FUNCTION public.maintain_effective_tag_from_direct_context();


--
-- Name: unit_tag_structure_support unit_tag_structure_support_effective_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_tag_structure_support_effective_maintain AFTER INSERT OR DELETE ON public.unit_tag_structure_support FOR EACH ROW EXECUTE FUNCTION public.maintain_effective_tag_from_structure_support();


--
-- Name: unit_tag_vote unit_tag_vote_effective_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_tag_vote_effective_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_tag_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_effective_tag_from_direct_vote();


--
-- Name: unit_effective_tag_vote unit_tag_vote_stat_maintain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_tag_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_effective_tag_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_vote_stat();


--
-- Name: unit_tag_vote unit_tag_vote_structure_conflict; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_tag_vote_structure_conflict BEFORE INSERT OR UPDATE ON public.unit_tag_vote FOR EACH ROW EXECUTE FUNCTION public.reject_conflicting_direct_tag_vote();


--
-- Name: unit_variant unit_variant_star_enforce; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER unit_variant_star_enforce BEFORE INSERT OR UPDATE OF variant_unit_id, main_unit_id ON public.unit_variant FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_variant_star();


--
-- Name: account_enforcement account_enforcement_0u72xwXJHy8M_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_enforcement
    ADD CONSTRAINT "account_enforcement_0u72xwXJHy8M_fkey" FOREIGN KEY (revocation_action_id) REFERENCES public.moderation_action(id) ON DELETE RESTRICT;


--
-- Name: account_enforcement account_enforcement_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_enforcement
    ADD CONSTRAINT account_enforcement_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: account_enforcement account_enforcement_uDabDcwN9p4k_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_enforcement
    ADD CONSTRAINT "account_enforcement_uDabDcwN9p4k_fkey" FOREIGN KEY (decision_action_id) REFERENCES public.moderation_action(id) ON DELETE RESTRICT;


--
-- Name: accounts accounts_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_account_quota_binding api_account_quota_binding_4WtImkXpd3J0_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_account_quota_binding
    ADD CONSTRAINT "api_account_quota_binding_4WtImkXpd3J0_fkey" FOREIGN KEY (assigned_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: api_account_quota_binding api_account_quota_binding_policy_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_account_quota_binding
    ADD CONSTRAINT api_account_quota_binding_policy_kind_fkey FOREIGN KEY (policy_id, policy_subject_kind) REFERENCES public.api_quota_policy(id, subject_kind) ON DELETE RESTRICT;


--
-- Name: api_account_quota_binding api_account_quota_binding_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_account_quota_binding
    ADD CONSTRAINT api_account_quota_binding_user_id_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_quota_daily_usage api_quota_daily_usage_account_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_daily_usage
    ADD CONSTRAINT api_quota_daily_usage_account_user_id_users_id_fkey FOREIGN KEY (account_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_quota_daily_usage api_quota_daily_usage_token_id_apikeys_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_daily_usage
    ADD CONSTRAINT api_quota_daily_usage_token_id_apikeys_id_fkey FOREIGN KEY (token_id) REFERENCES public.apikeys(id) ON DELETE CASCADE;


--
-- Name: api_quota_policy_revision api_quota_policy_revision_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_policy_revision
    ADD CONSTRAINT api_quota_policy_revision_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: api_quota_policy_revision api_quota_policy_revision_policy_id_api_quota_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_policy_revision
    ADD CONSTRAINT api_quota_policy_revision_policy_id_api_quota_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.api_quota_policy(id) ON DELETE CASCADE;


--
-- Name: api_quota_rate_state api_quota_rate_state_account_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_rate_state
    ADD CONSTRAINT api_quota_rate_state_account_user_id_users_id_fkey FOREIGN KEY (account_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_quota_rate_state api_quota_rate_state_token_id_apikeys_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_rate_state
    ADD CONSTRAINT api_quota_rate_state_token_id_apikeys_id_fkey FOREIGN KEY (token_id) REFERENCES public.apikeys(id) ON DELETE CASCADE;


--
-- Name: api_quota_request_lease api_quota_request_lease_account_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_request_lease
    ADD CONSTRAINT api_quota_request_lease_account_user_id_users_id_fkey FOREIGN KEY (account_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_quota_request_lease api_quota_request_lease_token_id_apikeys_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_quota_request_lease
    ADD CONSTRAINT api_quota_request_lease_token_id_apikeys_id_fkey FOREIGN KEY (token_id) REFERENCES public.apikeys(id) ON DELETE CASCADE;


--
-- Name: api_token_creation_reservation api_token_creation_reservation_account_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_creation_reservation
    ADD CONSTRAINT api_token_creation_reservation_account_user_id_users_id_fkey FOREIGN KEY (account_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_token_quota_binding api_token_quota_binding_assigned_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_quota_binding
    ADD CONSTRAINT api_token_quota_binding_assigned_by_profile_id_profile_id_fkey FOREIGN KEY (assigned_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: api_token_quota_binding api_token_quota_binding_policy_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_quota_binding
    ADD CONSTRAINT api_token_quota_binding_policy_kind_fkey FOREIGN KEY (policy_id, policy_subject_kind) REFERENCES public.api_quota_policy(id, subject_kind) ON DELETE RESTRICT;


--
-- Name: api_token_quota_binding api_token_quota_binding_token_id_apikeys_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_quota_binding
    ADD CONSTRAINT api_token_quota_binding_token_id_apikeys_id_fkey FOREIGN KEY (token_id) REFERENCES public.apikeys(id) ON DELETE CASCADE;


--
-- Name: api_token_quota_override api_token_quota_override_token_id_apikeys_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_quota_override
    ADD CONSTRAINT api_token_quota_override_token_id_apikeys_id_fkey FOREIGN KEY (token_id) REFERENCES public.apikeys(id) ON DELETE CASCADE;


--
-- Name: api_token_quota_override api_token_quota_override_updated_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_token_quota_override
    ADD CONSTRAINT api_token_quota_override_updated_by_profile_id_profile_id_fkey FOREIGN KEY (updated_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: apikeys apikeys_reference_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apikeys
    ADD CONSTRAINT apikeys_reference_id_users_id_fkey FOREIGN KEY (reference_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audio audio_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio
    ADD CONSTRAINT audio_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: audit_event audit_event_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_event
    ADD CONSTRAINT audit_event_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: book_chapter_progress_stat book_chapter_progress_stat_book_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_chapter_progress_stat
    ADD CONSTRAINT book_chapter_progress_stat_book_unit_id_unit_id_fkey FOREIGN KEY (book_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: book_chapter_progress_stat book_chapter_progress_stat_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_chapter_progress_stat
    ADD CONSTRAINT book_chapter_progress_stat_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: book_chapter_stat book_chapter_stat_book_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_chapter_stat
    ADD CONSTRAINT book_chapter_stat_book_unit_id_unit_id_fkey FOREIGN KEY (book_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: book book_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book
    ADD CONSTRAINT book_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: book_localized_content_metric_stat book_localized_content_metric_stat_book_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_localized_content_metric_stat
    ADD CONSTRAINT book_localized_content_metric_stat_book_unit_id_unit_id_fkey FOREIGN KEY (book_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: collection collection_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection
    ADD CONSTRAINT collection_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: collection_item collection_item_added_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_item
    ADD CONSTRAINT collection_item_added_by_profile_id_profile_id_fkey FOREIGN KEY (added_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: collection_item collection_item_collection_id_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_item
    ADD CONSTRAINT collection_item_collection_id_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collection(id) ON DELETE CASCADE;


--
-- Name: collection_item collection_item_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_item
    ADD CONSTRAINT collection_item_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: collection_stat collection_stat_collection_id_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_stat
    ADD CONSTRAINT collection_stat_collection_id_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collection(id) ON DELETE CASCADE;


--
-- Name: collection_structure_revision collection_structure_revision_FRTr4YXDyec2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision
    ADD CONSTRAINT "collection_structure_revision_FRTr4YXDyec2_fkey" FOREIGN KEY (content_id) REFERENCES public.revision_content(id) ON DELETE RESTRICT;


--
-- Name: collection_structure_revision collection_structure_revision_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision
    ADD CONSTRAINT collection_structure_revision_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: collection_structure_revision collection_structure_revision_collection_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision
    ADD CONSTRAINT collection_structure_revision_collection_fkey FOREIGN KEY (collection_id) REFERENCES public.collection(id) ON DELETE RESTRICT;


--
-- Name: collection_structure_revision_head collection_structure_revision_head_collection_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision_head
    ADD CONSTRAINT collection_structure_revision_head_collection_fkey FOREIGN KEY (collection_id) REFERENCES public.collection(id) ON DELETE CASCADE;


--
-- Name: collection_structure_revision_head collection_structure_revision_head_revision_collection_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision_head
    ADD CONSTRAINT collection_structure_revision_head_revision_collection_fkey FOREIGN KEY (revision_id, collection_id) REFERENCES public.collection_structure_revision(id, collection_id) ON DELETE RESTRICT;


--
-- Name: collection_structure_revision collection_structure_revision_parent_collection_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision
    ADD CONSTRAINT collection_structure_revision_parent_collection_fkey FOREIGN KEY (parent_revision_id, collection_id) REFERENCES public.collection_structure_revision(id, collection_id) ON DELETE RESTRICT;


--
-- Name: collection_structure_revision collection_structure_revision_source_collection_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_structure_revision
    ADD CONSTRAINT collection_structure_revision_source_collection_fkey FOREIGN KEY (source_revision_id, collection_id) REFERENCES public.collection_structure_revision(id, collection_id) ON DELETE RESTRICT;


--
-- Name: content_structure_node content_structure_node_content_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node
    ADD CONSTRAINT content_structure_node_content_unit_id_unit_id_fkey FOREIGN KEY (content_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: content_structure_node content_structure_node_parent_structure_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node
    ADD CONSTRAINT content_structure_node_parent_structure_fkey FOREIGN KEY (parent_id, structure_id) REFERENCES public.content_structure_node(id, structure_id) ON DELETE RESTRICT;


--
-- Name: content_structure_node_progress content_structure_node_progress_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node_progress
    ADD CONSTRAINT content_structure_node_progress_node_fkey FOREIGN KEY (node_id) REFERENCES public.content_structure_node(id) ON DELETE CASCADE;


--
-- Name: content_structure_node_progress content_structure_node_progress_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node_progress
    ADD CONSTRAINT content_structure_node_progress_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: content_structure_node content_structure_node_structure_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node
    ADD CONSTRAINT content_structure_node_structure_owner_fkey FOREIGN KEY (structure_id, owner_unit_id) REFERENCES public.content_structure(id, owner_unit_id) ON DELETE CASCADE;


--
-- Name: content_structure_node content_structure_node_target_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_node
    ADD CONSTRAINT content_structure_node_target_unit_id_unit_id_fkey FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: content_structure content_structure_owner_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure
    ADD CONSTRAINT content_structure_owner_unit_id_unit_id_fkey FOREIGN KEY (owner_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: content_structure_revision content_structure_revision_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision
    ADD CONSTRAINT content_structure_revision_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: content_structure_revision content_structure_revision_content_id_revision_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision
    ADD CONSTRAINT content_structure_revision_content_id_revision_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.revision_content(id) ON DELETE RESTRICT;


--
-- Name: content_structure_revision_head content_structure_revision_head_revision_structure_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision_head
    ADD CONSTRAINT content_structure_revision_head_revision_structure_fkey FOREIGN KEY (revision_id, structure_id) REFERENCES public.content_structure_revision(id, structure_id) ON DELETE RESTRICT;


--
-- Name: content_structure_revision_head content_structure_revision_head_structure_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision_head
    ADD CONSTRAINT content_structure_revision_head_structure_fkey FOREIGN KEY (structure_id) REFERENCES public.content_structure(id) ON DELETE CASCADE;


--
-- Name: content_structure_revision content_structure_revision_parent_structure_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision
    ADD CONSTRAINT content_structure_revision_parent_structure_fkey FOREIGN KEY (parent_revision_id, structure_id) REFERENCES public.content_structure_revision(id, structure_id) ON DELETE RESTRICT;


--
-- Name: content_structure_revision content_structure_revision_source_structure_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision
    ADD CONSTRAINT content_structure_revision_source_structure_fkey FOREIGN KEY (source_revision_id, structure_id) REFERENCES public.content_structure_revision(id, structure_id) ON DELETE RESTRICT;


--
-- Name: content_structure_revision content_structure_revision_structure_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_structure_revision
    ADD CONSTRAINT content_structure_revision_structure_fkey FOREIGN KEY (structure_id) REFERENCES public.content_structure(id) ON DELETE RESTRICT;


--
-- Name: conversation conversation_participant_high_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_participant_high_profile_id_profile_id_fkey FOREIGN KEY (participant_high_profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: conversation conversation_participant_low_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation
    ADD CONSTRAINT conversation_participant_low_profile_id_profile_id_fkey FOREIGN KEY (participant_low_profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: conversation_participant_stat conversation_participant_stat_DiJvtVmN2IBI_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant_stat
    ADD CONSTRAINT "conversation_participant_stat_DiJvtVmN2IBI_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;


--
-- Name: conversation_participant_stat conversation_participant_stat_last_message_id_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant_stat
    ADD CONSTRAINT conversation_participant_stat_last_message_id_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.message(id) ON DELETE SET NULL;


--
-- Name: conversation_participant_stat conversation_participant_stat_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participant_stat
    ADD CONSTRAINT conversation_participant_stat_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: conversation_read conversation_read_conversation_id_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_read
    ADD CONSTRAINT conversation_read_conversation_id_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;


--
-- Name: conversation_read conversation_read_last_read_message_id_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_read
    ADD CONSTRAINT conversation_read_last_read_message_id_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES public.message(id) ON DELETE SET NULL;


--
-- Name: conversation_read conversation_read_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_read
    ADD CONSTRAINT conversation_read_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: conversation_stat conversation_stat_conversation_id_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_stat
    ADD CONSTRAINT conversation_stat_conversation_id_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;


--
-- Name: conversation_stat conversation_stat_last_message_id_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_stat
    ADD CONSTRAINT conversation_stat_last_message_id_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.message(id) ON DELETE SET NULL;


--
-- Name: credit_attribution credit_attribution_credited_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_attribution
    ADD CONSTRAINT credit_attribution_credited_unit_id_unit_id_fkey FOREIGN KEY (credited_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: credit_attribution credit_attribution_source_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_attribution
    ADD CONSTRAINT credit_attribution_source_unit_id_unit_id_fkey FOREIGN KEY (source_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: dock_revision dock_revision_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision
    ADD CONSTRAINT dock_revision_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: dock_revision dock_revision_content_id_revision_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision
    ADD CONSTRAINT dock_revision_content_id_revision_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.revision_content(id) ON DELETE RESTRICT;


--
-- Name: dock_revision dock_revision_dock_id_unit_dock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision
    ADD CONSTRAINT dock_revision_dock_id_unit_dock_id_fkey FOREIGN KEY (dock_id) REFERENCES public.unit_dock(id) ON DELETE RESTRICT;


--
-- Name: dock_revision_head dock_revision_head_dock_id_unit_dock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision_head
    ADD CONSTRAINT dock_revision_head_dock_id_unit_dock_id_fkey FOREIGN KEY (dock_id) REFERENCES public.unit_dock(id) ON DELETE CASCADE;


--
-- Name: dock_revision_head dock_revision_head_revision_dock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision_head
    ADD CONSTRAINT dock_revision_head_revision_dock_fkey FOREIGN KEY (revision_id, dock_id) REFERENCES public.dock_revision(id, dock_id) ON DELETE RESTRICT;


--
-- Name: dock_revision dock_revision_parent_dock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision
    ADD CONSTRAINT dock_revision_parent_dock_fkey FOREIGN KEY (parent_revision_id, dock_id) REFERENCES public.dock_revision(id, dock_id) ON DELETE RESTRICT;


--
-- Name: dock_revision dock_revision_source_dock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dock_revision
    ADD CONSTRAINT dock_revision_source_dock_fkey FOREIGN KEY (source_revision_id, dock_id) REFERENCES public.dock_revision(id, dock_id) ON DELETE RESTRICT;


--
-- Name: email_outbox email_outbox_notification_id_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_notification_id_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notification(id) ON DELETE CASCADE;


--
-- Name: entity entity_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: governance_post_binding governance_post_binding_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_post_binding
    ADD CONSTRAINT governance_post_binding_post_id_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.post(id) ON DELETE RESTRICT;


--
-- Name: image_asset image_asset_owner_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_asset
    ADD CONSTRAINT image_asset_owner_profile_id_profile_id_fkey FOREIGN KEY (owner_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: image_asset_presentation image_asset_presentation_asset_id_image_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_asset_presentation
    ADD CONSTRAINT image_asset_presentation_asset_id_image_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.image_asset(id) ON DELETE CASCADE;


--
-- Name: image_asset image_asset_uploader_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_asset
    ADD CONSTRAINT image_asset_uploader_profile_id_profile_id_fkey FOREIGN KEY (uploader_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: image_object image_object_asset_id_image_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_object
    ADD CONSTRAINT image_object_asset_id_image_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.image_asset(id) ON DELETE CASCADE;


--
-- Name: label label_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label
    ADD CONSTRAINT label_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: media media_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: message message_conversation_id_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_conversation_id_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation(id) ON DELETE CASCADE;


--
-- Name: message message_sender_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_sender_profile_id_profile_id_fkey FOREIGN KEY (sender_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: moderation_action moderation_action_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_action
    ADD CONSTRAINT moderation_action_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: moderation_action moderation_action_case_id_moderation_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_action
    ADD CONSTRAINT moderation_action_case_id_moderation_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.moderation_case(id) ON DELETE RESTRICT;


--
-- Name: moderation_action moderation_action_content_license_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_action
    ADD CONSTRAINT moderation_action_content_license_fkey FOREIGN KEY (content_license_id) REFERENCES public.unit_content_license(id) ON DELETE RESTRICT;


--
-- Name: moderation_action moderation_action_reverses_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_action
    ADD CONSTRAINT moderation_action_reverses_fkey FOREIGN KEY (reverses_action_id) REFERENCES public.moderation_action(id) ON DELETE RESTRICT;


--
-- Name: moderation_case moderation_case_assigned_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_case
    ADD CONSTRAINT moderation_case_assigned_profile_id_profile_id_fkey FOREIGN KEY (assigned_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: moderation_case moderation_case_duplicate_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_case
    ADD CONSTRAINT moderation_case_duplicate_fkey FOREIGN KEY (duplicate_of_case_id) REFERENCES public.moderation_case(id) ON DELETE SET NULL;


--
-- Name: moderation_case moderation_case_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_case
    ADD CONSTRAINT moderation_case_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT;


--
-- Name: notification notification_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: notification_preference notification_preference_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preference
    ADD CONSTRAINT notification_preference_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: notification notification_recipient_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_recipient_profile_id_profile_id_fkey FOREIGN KEY (recipient_profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: notification_recipient_stat notification_recipient_stat_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_recipient_stat
    ADD CONSTRAINT notification_recipient_stat_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: notification notification_subject_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_subject_unit_id_unit_id_fkey FOREIGN KEY (subject_unit_id) REFERENCES public.unit(id) ON DELETE SET NULL;


--
-- Name: platform_capability_grant platform_capability_grant_granted_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_capability_grant
    ADD CONSTRAINT platform_capability_grant_granted_by_profile_id_profile_id_fkey FOREIGN KEY (granted_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: platform_capability_grant platform_capability_grant_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_capability_grant
    ADD CONSTRAINT platform_capability_grant_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: platform_capability_grant platform_capability_grant_revoked_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_capability_grant
    ADD CONSTRAINT platform_capability_grant_revoked_by_profile_id_profile_id_fkey FOREIGN KEY (revoked_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: platform_unit_report platform_unit_report_case_id_moderation_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_case_id_moderation_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.moderation_case(id) ON DELETE RESTRICT;


--
-- Name: platform_unit_report platform_unit_report_reporter_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_reporter_profile_id_profile_id_fkey FOREIGN KEY (reporter_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: platform_unit_report platform_unit_report_revision_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_revision_unit_fkey FOREIGN KEY (reported_revision_id, unit_id) REFERENCES public.unit_revision(id, unit_id) ON DELETE RESTRICT;


--
-- Name: platform_unit_report platform_unit_report_rule_id_realm_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_rule_id_realm_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.realm_rule(id) ON DELETE RESTRICT;


--
-- Name: platform_unit_report platform_unit_report_rule_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_rule_revision_fkey FOREIGN KEY (rule_id, rule_revision_id) REFERENCES public.realm_rule(id, revision_id) ON DELETE RESTRICT;


--
-- Name: platform_unit_report platform_unit_report_rule_revision_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_rule_revision_realm_fkey FOREIGN KEY (rule_source_realm_id, rule_revision_id) REFERENCES public.realm_rule_revision(realm_id, id) ON DELETE RESTRICT;


--
-- Name: platform_unit_report platform_unit_report_rule_source_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_rule_source_realm_id_realm_id_fkey FOREIGN KEY (rule_source_realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT;


--
-- Name: platform_unit_report platform_unit_report_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_unit_report
    ADD CONSTRAINT platform_unit_report_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: poll poll_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll
    ADD CONSTRAINT poll_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: poll_option poll_option_poll_id_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_option
    ADD CONSTRAINT poll_option_poll_id_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.poll(id) ON DELETE CASCADE;


--
-- Name: poll_option poll_option_target_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_option
    ADD CONSTRAINT poll_option_target_unit_id_unit_id_fkey FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: poll_option_vote_stat poll_option_vote_stat_option_id_poll_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_option_vote_stat
    ADD CONSTRAINT poll_option_vote_stat_option_id_poll_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.poll_option(id) ON DELETE CASCADE;


--
-- Name: poll_vote poll_vote_option_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_vote
    ADD CONSTRAINT poll_vote_option_fkey FOREIGN KEY (poll_id, option_id) REFERENCES public.poll_option(poll_id, id) ON DELETE RESTRICT;


--
-- Name: poll_vote poll_vote_poll_id_poll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_vote
    ADD CONSTRAINT poll_vote_poll_id_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.poll(id) ON DELETE CASCADE;


--
-- Name: poll_vote poll_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_vote
    ADD CONSTRAINT poll_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: poll_vote poll_vote_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poll_vote
    ADD CONSTRAINT poll_vote_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE SET NULL;


--
-- Name: post post_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: post_progress_entry post_progress_entry_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_progress_entry
    ADD CONSTRAINT post_progress_entry_post_id_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.post(id) ON DELETE CASCADE;


--
-- Name: post_progress_entry post_progress_entry_progress_entry_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_progress_entry
    ADD CONSTRAINT post_progress_entry_progress_entry_fkey FOREIGN KEY (progress_entry_id) REFERENCES public.unit_progress_entry(id) ON DELETE CASCADE;


--
-- Name: post_reply post_reply_parent_root_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reply
    ADD CONSTRAINT post_reply_parent_root_fkey FOREIGN KEY (parent_post_id, root_post_id) REFERENCES public.post_reply(post_id, root_post_id) ON DELETE RESTRICT;


--
-- Name: post_reply post_reply_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reply
    ADD CONSTRAINT post_reply_post_id_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.post(id) ON DELETE CASCADE;


--
-- Name: post_reply post_reply_root_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reply
    ADD CONSTRAINT post_reply_root_post_id_post_id_fkey FOREIGN KEY (root_post_id) REFERENCES public.post(id) ON DELETE RESTRICT;


--
-- Name: post_reply_stat post_reply_stat_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reply_stat
    ADD CONSTRAINT post_reply_stat_post_id_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.post(id) ON DELETE CASCADE;


--
-- Name: post_score post_score_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_score
    ADD CONSTRAINT post_score_post_id_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.post(id) ON DELETE CASCADE;


--
-- Name: post_score post_score_score_id_score_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_score
    ADD CONSTRAINT post_score_score_id_score_id_fkey FOREIGN KEY (score_id) REFERENCES public.score(id) ON DELETE CASCADE;


--
-- Name: post post_subject_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_subject_unit_id_unit_id_fkey FOREIGN KEY (subject_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: profile profile_auth_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_auth_user_id_users_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: profile_block profile_block_blocked_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_block
    ADD CONSTRAINT profile_block_blocked_profile_id_profile_id_fkey FOREIGN KEY (blocked_profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile_block profile_block_blocker_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_block
    ADD CONSTRAINT profile_block_blocker_profile_id_profile_id_fkey FOREIGN KEY (blocker_profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile_favorites_collection profile_favorites_collection_collection_id_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_favorites_collection
    ADD CONSTRAINT profile_favorites_collection_collection_id_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collection(id) ON DELETE CASCADE;


--
-- Name: profile_favorites_collection profile_favorites_collection_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_favorites_collection
    ADD CONSTRAINT profile_favorites_collection_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile profile_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: profile_preference profile_preference_default_score_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_preference
    ADD CONSTRAINT profile_preference_default_score_realm_id_realm_id_fkey FOREIGN KEY (default_score_realm_id) REFERENCES public.realm(id) ON DELETE SET NULL;


--
-- Name: profile_preference profile_preference_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_preference
    ADD CONSTRAINT profile_preference_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile_realm_tag_subscription profile_realm_tag_subscription_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_realm_tag_subscription
    ADD CONSTRAINT profile_realm_tag_subscription_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile_realm_tag_subscription profile_realm_tag_subscription_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_realm_tag_subscription
    ADD CONSTRAINT profile_realm_tag_subscription_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: profile_unit_tag profile_unit_tag_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_unit_tag
    ADD CONSTRAINT profile_unit_tag_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: profile_unit_tag profile_unit_tag_tag_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_unit_tag
    ADD CONSTRAINT profile_unit_tag_tag_id_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: profile_unit_tag profile_unit_tag_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_unit_tag
    ADD CONSTRAINT profile_unit_tag_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: realm realm_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm
    ADD CONSTRAINT realm_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: realm_member realm_member_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_member
    ADD CONSTRAINT realm_member_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: realm_member realm_member_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_member
    ADD CONSTRAINT realm_member_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_pin realm_pin_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_pin
    ADD CONSTRAINT realm_pin_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: realm_pin realm_pin_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_pin
    ADD CONSTRAINT realm_pin_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_pin realm_pin_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_pin
    ADD CONSTRAINT realm_pin_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: realm_rule_acceptance realm_rule_acceptance_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_acceptance
    ADD CONSTRAINT realm_rule_acceptance_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: realm_rule_acceptance realm_rule_acceptance_revision_id_realm_rule_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_acceptance
    ADD CONSTRAINT realm_rule_acceptance_revision_id_realm_rule_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.realm_rule_revision(id) ON DELETE CASCADE;


--
-- Name: realm_rule realm_rule_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule
    ADD CONSTRAINT realm_rule_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: realm_rule_revision realm_rule_revision_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_revision
    ADD CONSTRAINT realm_rule_revision_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: realm_rule realm_rule_revision_id_realm_rule_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule
    ADD CONSTRAINT realm_rule_revision_id_realm_rule_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.realm_rule_revision(id) ON DELETE CASCADE;


--
-- Name: realm_rule_revision realm_rule_revision_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_rule_revision
    ADD CONSTRAINT realm_rule_revision_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_score_context realm_score_context_context_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_score_context
    ADD CONSTRAINT realm_score_context_context_post_id_post_id_fkey FOREIGN KEY (context_post_id) REFERENCES public.post(id) ON DELETE RESTRICT;


--
-- Name: realm_score_context realm_score_context_post_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_score_context
    ADD CONSTRAINT realm_score_context_post_realm_fkey FOREIGN KEY (realm_id, context_post_id) REFERENCES public.realm_unit(realm_id, unit_id) ON DELETE RESTRICT;


--
-- Name: realm_score_context realm_score_context_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_score_context
    ADD CONSTRAINT realm_score_context_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_stat realm_stat_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_stat
    ADD CONSTRAINT realm_stat_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_tag_context realm_tag_context_context_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_context
    ADD CONSTRAINT realm_tag_context_context_post_id_post_id_fkey FOREIGN KEY (context_post_id) REFERENCES public.post(id) ON DELETE RESTRICT;


--
-- Name: realm_tag_context realm_tag_context_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_context
    ADD CONSTRAINT realm_tag_context_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: realm_tag_context realm_tag_context_post_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_context
    ADD CONSTRAINT realm_tag_context_post_realm_fkey FOREIGN KEY (realm_id, context_post_id) REFERENCES public.realm_unit(realm_id, unit_id) ON DELETE RESTRICT;


--
-- Name: realm_tag_context realm_tag_context_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_context
    ADD CONSTRAINT realm_tag_context_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_tag_context realm_tag_context_tag_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_context
    ADD CONSTRAINT realm_tag_context_tag_id_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE RESTRICT;


--
-- Name: realm_tag_vote realm_tag_vote_context_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote
    ADD CONSTRAINT realm_tag_vote_context_fkey FOREIGN KEY (realm_id, tag_id) REFERENCES public.realm_tag_context(realm_id, tag_id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote realm_tag_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote
    ADD CONSTRAINT realm_tag_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote realm_tag_vote_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote
    ADD CONSTRAINT realm_tag_vote_realm_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote_stat realm_tag_vote_stat_context_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote_stat
    ADD CONSTRAINT realm_tag_vote_stat_context_fkey FOREIGN KEY (realm_id, tag_id) REFERENCES public.realm_tag_context(realm_id, tag_id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote_stat realm_tag_vote_stat_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote_stat
    ADD CONSTRAINT realm_tag_vote_stat_realm_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote_stat realm_tag_vote_stat_tag_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote_stat
    ADD CONSTRAINT realm_tag_vote_stat_tag_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote_stat realm_tag_vote_stat_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote_stat
    ADD CONSTRAINT realm_tag_vote_stat_unit_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote realm_tag_vote_tag_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote
    ADD CONSTRAINT realm_tag_vote_tag_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: realm_tag_vote realm_tag_vote_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_tag_vote
    ADD CONSTRAINT realm_tag_vote_unit_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: realm_unit_moderation_stat realm_unit_moderation_stat_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_moderation_stat
    ADD CONSTRAINT realm_unit_moderation_stat_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_unit_moderation_stat realm_unit_moderation_stat_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_moderation_stat
    ADD CONSTRAINT realm_unit_moderation_stat_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: realm_unit_publication_event realm_unit_publication_event_EI9OF02bgNWn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_publication_event
    ADD CONSTRAINT "realm_unit_publication_event_EI9OF02bgNWn_fkey" FOREIGN KEY (changed_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: realm_unit_publication_event realm_unit_publication_event_relation_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_publication_event
    ADD CONSTRAINT realm_unit_publication_event_relation_fkey FOREIGN KEY (realm_id, unit_id) REFERENCES public.realm_unit(realm_id, unit_id) ON DELETE RESTRICT;


--
-- Name: realm_unit realm_unit_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit
    ADD CONSTRAINT realm_unit_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: realm_unit_report realm_unit_report_case_id_moderation_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_case_id_moderation_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.moderation_case(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_realm_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_realm_unit_fkey FOREIGN KEY (realm_id, unit_id) REFERENCES public.realm_unit(realm_id, unit_id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_reporter_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_reporter_profile_id_profile_id_fkey FOREIGN KEY (reporter_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_revision_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_revision_unit_fkey FOREIGN KEY (reported_revision_id, unit_id) REFERENCES public.unit_revision(id, unit_id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_rule_id_realm_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_rule_id_realm_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.realm_rule(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_rule_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_rule_revision_fkey FOREIGN KEY (rule_id, rule_revision_id) REFERENCES public.realm_rule(id, revision_id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_rule_revision_realm_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_rule_revision_realm_fkey FOREIGN KEY (realm_id, rule_revision_id) REFERENCES public.realm_rule_revision(realm_id, id) ON DELETE RESTRICT;


--
-- Name: realm_unit_report realm_unit_report_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_report
    ADD CONSTRAINT realm_unit_report_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_status_event realm_unit_status_event_changed_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_status_event
    ADD CONSTRAINT realm_unit_status_event_changed_by_profile_id_profile_id_fkey FOREIGN KEY (changed_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: realm_unit_status_event realm_unit_status_event_moderation_action_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_status_event
    ADD CONSTRAINT realm_unit_status_event_moderation_action_fkey FOREIGN KEY (moderation_action_id) REFERENCES public.moderation_action(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_status_event realm_unit_status_event_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_status_event
    ADD CONSTRAINT realm_unit_status_event_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_status_event realm_unit_status_event_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_status_event
    ADD CONSTRAINT realm_unit_status_event_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_tag realm_unit_tag_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_tag
    ADD CONSTRAINT realm_unit_tag_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: realm_unit_tag realm_unit_tag_realm_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_tag
    ADD CONSTRAINT realm_unit_tag_realm_unit_fkey FOREIGN KEY (realm_id, unit_id) REFERENCES public.realm_unit(realm_id, unit_id) ON DELETE CASCADE;


--
-- Name: realm_unit_tag realm_unit_tag_tag_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit_tag
    ADD CONSTRAINT realm_unit_tag_tag_id_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: realm_unit realm_unit_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realm_unit
    ADD CONSTRAINT realm_unit_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_unit_edge recommendation_edge_snapshot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_edge
    ADD CONSTRAINT recommendation_edge_snapshot_fkey FOREIGN KEY (snapshot_id) REFERENCES public.recommendation_snapshot(id) ON DELETE CASCADE;


--
-- Name: recommendation_event recommendation_event_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_event
    ADD CONSTRAINT recommendation_event_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: recommendation_event recommendation_event_target_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_event
    ADD CONSTRAINT recommendation_event_target_unit_id_unit_id_fkey FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_exclusion recommendation_exclusion_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_exclusion
    ADD CONSTRAINT recommendation_exclusion_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: recommendation_exclusion recommendation_exclusion_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_exclusion
    ADD CONSTRAINT recommendation_exclusion_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_profile_interest recommendation_interest_snapshot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_profile_interest
    ADD CONSTRAINT recommendation_interest_snapshot_fkey FOREIGN KEY (snapshot_id) REFERENCES public.recommendation_snapshot(id) ON DELETE CASCADE;


--
-- Name: recommendation_profile_interest recommendation_profile_interest_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_profile_interest
    ADD CONSTRAINT recommendation_profile_interest_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: recommendation_profile_interest recommendation_profile_interest_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_profile_interest
    ADD CONSTRAINT recommendation_profile_interest_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_profile_signal_hourly recommendation_profile_signal_hourly_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_profile_signal_hourly
    ADD CONSTRAINT recommendation_profile_signal_hourly_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: recommendation_profile_signal_hourly recommendation_profile_signal_hourly_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_profile_signal_hourly
    ADD CONSTRAINT recommendation_profile_signal_hourly_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_unit_stat recommendation_stat_snapshot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_stat
    ADD CONSTRAINT recommendation_stat_snapshot_fkey FOREIGN KEY (snapshot_id) REFERENCES public.recommendation_snapshot(id) ON DELETE CASCADE;


--
-- Name: recommendation_unit_edge recommendation_unit_edge_source_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_edge
    ADD CONSTRAINT recommendation_unit_edge_source_unit_id_unit_id_fkey FOREIGN KEY (source_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_unit_edge recommendation_unit_edge_target_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_edge
    ADD CONSTRAINT recommendation_unit_edge_target_unit_id_unit_id_fkey FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_unit_signal_hourly recommendation_unit_signal_hourly_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_signal_hourly
    ADD CONSTRAINT recommendation_unit_signal_hourly_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: recommendation_unit_stat recommendation_unit_stat_context_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_stat
    ADD CONSTRAINT recommendation_unit_stat_context_realm_id_realm_id_fkey FOREIGN KEY (context_realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: recommendation_unit_stat recommendation_unit_stat_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendation_unit_stat
    ADD CONSTRAINT recommendation_unit_stat_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: release release_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release
    ADD CONSTRAINT release_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: release release_parent_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release
    ADD CONSTRAINT release_parent_unit_id_unit_id_fkey FOREIGN KEY (parent_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: revision_content revision_content_base_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_content
    ADD CONSTRAINT revision_content_base_fkey FOREIGN KEY (base_content_id) REFERENCES public.revision_content(id) ON DELETE RESTRICT;


--
-- Name: score score_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score
    ADD CONSTRAINT score_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: score score_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score
    ADD CONSTRAINT score_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: score_stat score_stat_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score_stat
    ADD CONSTRAINT score_stat_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: score_stat score_stat_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score_stat
    ADD CONSTRAINT score_stat_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: score score_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score
    ADD CONSTRAINT score_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: search_document_revision search_document_revision_ZC2zfwbpr0zU_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision
    ADD CONSTRAINT "search_document_revision_ZC2zfwbpr0zU_fkey" FOREIGN KEY (search_document_id) REFERENCES public.search_document(id) ON DELETE RESTRICT;


--
-- Name: search_document_revision search_document_revision_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision
    ADD CONSTRAINT search_document_revision_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: search_document_revision search_document_revision_content_id_revision_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision
    ADD CONSTRAINT search_document_revision_content_id_revision_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.revision_content(id) ON DELETE RESTRICT;


--
-- Name: search_document_revision_head search_document_revision_head_j33SFm4nAjNl_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision_head
    ADD CONSTRAINT "search_document_revision_head_j33SFm4nAjNl_fkey" FOREIGN KEY (search_document_id) REFERENCES public.search_document(id) ON DELETE CASCADE;


--
-- Name: search_document_revision_head search_document_revision_head_revision_document_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision_head
    ADD CONSTRAINT search_document_revision_head_revision_document_fkey FOREIGN KEY (revision_id, search_document_id) REFERENCES public.search_document_revision(id, search_document_id) ON DELETE RESTRICT;


--
-- Name: search_document_revision search_document_revision_parent_document_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision
    ADD CONSTRAINT search_document_revision_parent_document_fkey FOREIGN KEY (parent_revision_id, search_document_id) REFERENCES public.search_document_revision(id, search_document_id) ON DELETE RESTRICT;


--
-- Name: search_document_revision search_document_revision_source_document_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_document_revision
    ADD CONSTRAINT search_document_revision_source_document_fkey FOREIGN KEY (source_revision_id, search_document_id) REFERENCES public.search_document_revision(id, search_document_id) ON DELETE RESTRICT;


--
-- Name: series series_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: series_release series_release_release_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_release
    ADD CONSTRAINT series_release_release_unit_id_unit_id_fkey FOREIGN KEY (release_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: series_release series_release_series_id_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_release
    ADD CONSTRAINT series_release_series_id_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shared_search_query shared_search_query_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_search_query
    ADD CONSTRAINT shared_search_query_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: software software_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software
    ADD CONSTRAINT software_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: software_requirement software_requirement_platform_entity_id_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_requirement
    ADD CONSTRAINT software_requirement_platform_entity_id_entity_id_fkey FOREIGN KEY (platform_entity_id) REFERENCES public.entity(id) ON DELETE SET NULL;


--
-- Name: software_requirement software_requirement_software_id_software_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_requirement
    ADD CONSTRAINT software_requirement_software_id_software_id_fkey FOREIGN KEY (software_id) REFERENCES public.software(id) ON DELETE CASCADE;


--
-- Name: software_requirement software_requirement_source_link_id_unit_source_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.software_requirement
    ADD CONSTRAINT software_requirement_source_link_id_unit_source_link_id_fkey FOREIGN KEY (source_link_id) REFERENCES public.unit_source_link(id) ON DELETE SET NULL;


--
-- Name: studio_resource_visit studio_resource_visit_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_resource_visit
    ADD CONSTRAINT studio_resource_visit_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: studio_resource_visit studio_resource_visit_resource_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_resource_visit
    ADD CONSTRAINT studio_resource_visit_resource_unit_id_unit_id_fkey FOREIGN KEY (resource_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: studio_work_relation studio_work_relation_authorization_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_work_relation
    ADD CONSTRAINT studio_work_relation_authorization_unit_id_unit_id_fkey FOREIGN KEY (authorization_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: studio_work_relation studio_work_relation_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_work_relation
    ADD CONSTRAINT studio_work_relation_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: studio_work_relation studio_work_relation_resource_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_work_relation
    ADD CONSTRAINT studio_work_relation_resource_unit_id_unit_id_fkey FOREIGN KEY (resource_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: subject_association subject_association_context_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_association
    ADD CONSTRAINT subject_association_context_post_id_post_id_fkey FOREIGN KEY (context_post_id) REFERENCES public.post(id) ON DELETE RESTRICT;


--
-- Name: subject_association subject_association_entity_id_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_association
    ADD CONSTRAINT subject_association_entity_id_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(id) ON DELETE RESTRICT;


--
-- Name: subject_association subject_association_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_association
    ADD CONSTRAINT subject_association_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: tag tag_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_access_grant unit_access_grant_granted_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_grant
    ADD CONSTRAINT unit_access_grant_granted_by_profile_id_profile_id_fkey FOREIGN KEY (granted_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_access_grant unit_access_grant_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_grant
    ADD CONSTRAINT unit_access_grant_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_access_grant unit_access_grant_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_grant
    ADD CONSTRAINT unit_access_grant_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: unit_access_grant unit_access_grant_revoked_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_grant
    ADD CONSTRAINT unit_access_grant_revoked_by_profile_id_profile_id_fkey FOREIGN KEY (revoked_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_access_grant unit_access_grant_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_grant
    ADD CONSTRAINT unit_access_grant_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_access_invitation unit_access_invitation_invited_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_invitation
    ADD CONSTRAINT unit_access_invitation_invited_by_profile_id_profile_id_fkey FOREIGN KEY (invited_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_access_invitation unit_access_invitation_invited_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_invitation
    ADD CONSTRAINT unit_access_invitation_invited_profile_id_profile_id_fkey FOREIGN KEY (invited_profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_access_invitation unit_access_invitation_resolved_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_invitation
    ADD CONSTRAINT unit_access_invitation_resolved_by_profile_id_profile_id_fkey FOREIGN KEY (resolved_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_access_invitation unit_access_invitation_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_invitation
    ADD CONSTRAINT unit_access_invitation_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_access_restriction unit_access_restriction_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_restriction
    ADD CONSTRAINT unit_access_restriction_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_access_restriction unit_access_restriction_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_restriction
    ADD CONSTRAINT unit_access_restriction_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_access_restriction unit_access_restriction_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_restriction
    ADD CONSTRAINT unit_access_restriction_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: unit_access_restriction unit_access_restriction_revoked_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_restriction
    ADD CONSTRAINT unit_access_restriction_revoked_by_profile_id_profile_id_fkey FOREIGN KEY (revoked_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_access_restriction unit_access_restriction_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_access_restriction
    ADD CONSTRAINT unit_access_restriction_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_alias unit_alias_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias
    ADD CONSTRAINT unit_alias_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: unit_alias unit_alias_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias
    ADD CONSTRAINT unit_alias_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_alias_vote unit_alias_vote_alias_id_unit_alias_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias_vote
    ADD CONSTRAINT unit_alias_vote_alias_id_unit_alias_id_fkey FOREIGN KEY (alias_id) REFERENCES public.unit_alias(id) ON DELETE CASCADE;


--
-- Name: unit_alias_vote unit_alias_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias_vote
    ADD CONSTRAINT unit_alias_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_alias_vote_stat unit_alias_vote_stat_alias_id_unit_alias_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_alias_vote_stat
    ADD CONSTRAINT unit_alias_vote_stat_alias_id_unit_alias_id_fkey FOREIGN KEY (alias_id) REFERENCES public.unit_alias(id) ON DELETE CASCADE;


--
-- Name: unit_association_proposal unit_association_proposal_context_post_id_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_association_proposal
    ADD CONSTRAINT unit_association_proposal_context_post_id_post_id_fkey FOREIGN KEY (context_post_id) REFERENCES public.post(id) ON DELETE RESTRICT;


--
-- Name: unit_association_proposal unit_association_proposal_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_association_proposal
    ADD CONSTRAINT unit_association_proposal_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_association_proposal unit_association_proposal_source_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_association_proposal
    ADD CONSTRAINT unit_association_proposal_source_unit_id_unit_id_fkey FOREIGN KEY (source_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_association_proposal unit_association_proposal_target_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_association_proposal
    ADD CONSTRAINT unit_association_proposal_target_unit_id_unit_id_fkey FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_association_proposal unit_association_proposal_xg3ooPLi5GS2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_association_proposal
    ADD CONSTRAINT "unit_association_proposal_xg3ooPLi5GS2_fkey" FOREIGN KEY (resolved_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_content_license unit_content_license_granted_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_content_license
    ADD CONSTRAINT unit_content_license_granted_by_profile_id_profile_id_fkey FOREIGN KEY (granted_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_content_license unit_content_license_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_content_license
    ADD CONSTRAINT unit_content_license_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_dock unit_dock_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_dock
    ADD CONSTRAINT unit_dock_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_effective_tag unit_effective_tag_tag_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_effective_tag
    ADD CONSTRAINT unit_effective_tag_tag_id_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: unit_effective_tag unit_effective_tag_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_effective_tag
    ADD CONSTRAINT unit_effective_tag_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_effective_tag_vote unit_effective_tag_vote_effective_tag_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_effective_tag_vote
    ADD CONSTRAINT unit_effective_tag_vote_effective_tag_fkey FOREIGN KEY (unit_id, tag_id) REFERENCES public.unit_effective_tag(unit_id, tag_id) ON DELETE CASCADE;


--
-- Name: unit_effective_tag_vote unit_effective_tag_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_effective_tag_vote
    ADD CONSTRAINT unit_effective_tag_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_engagement_stat unit_engagement_stat_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_engagement_stat
    ADD CONSTRAINT unit_engagement_stat_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_follow unit_follow_follower_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_follow
    ADD CONSTRAINT unit_follow_follower_profile_id_profile_id_fkey FOREIGN KEY (follower_profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_follow_notification_preference unit_follow_notification_preference_follow_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_follow_notification_preference
    ADD CONSTRAINT unit_follow_notification_preference_follow_fkey FOREIGN KEY (follower_profile_id, unit_id) REFERENCES public.unit_follow(follower_profile_id, unit_id) ON DELETE CASCADE;


--
-- Name: unit_follow_stat unit_follow_stat_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_follow_stat
    ADD CONSTRAINT unit_follow_stat_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_follow unit_follow_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_follow
    ADD CONSTRAINT unit_follow_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_localization unit_localization_avatar_asset_id_image_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization
    ADD CONSTRAINT unit_localization_avatar_asset_id_image_asset_id_fkey FOREIGN KEY (avatar_asset_id) REFERENCES public.image_asset(id) ON DELETE RESTRICT;


--
-- Name: unit_localization unit_localization_banner_asset_id_image_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization
    ADD CONSTRAINT unit_localization_banner_asset_id_image_asset_id_fkey FOREIGN KEY (banner_asset_id) REFERENCES public.image_asset(id) ON DELETE SET NULL;


--
-- Name: unit_localization_content_metric unit_localization_content_metric_localization_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization_content_metric
    ADD CONSTRAINT unit_localization_content_metric_localization_fkey FOREIGN KEY (unit_id, language) REFERENCES public.unit_localization(unit_id, language) ON DELETE CASCADE;


--
-- Name: unit_localization unit_localization_cover_asset_id_image_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization
    ADD CONSTRAINT unit_localization_cover_asset_id_image_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES public.image_asset(id) ON DELETE SET NULL;


--
-- Name: unit_localization unit_localization_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_localization
    ADD CONSTRAINT unit_localization_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_ownership unit_ownership_assigned_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership
    ADD CONSTRAINT unit_ownership_assigned_by_profile_id_profile_id_fkey FOREIGN KEY (assigned_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership_claim unit_ownership_claim_DCHXcYeTHQOw_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership_claim
    ADD CONSTRAINT "unit_ownership_claim_DCHXcYeTHQOw_fkey" FOREIGN KEY (resulting_ownership_id) REFERENCES public.unit_ownership(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership_claim unit_ownership_claim_claimant_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership_claim
    ADD CONSTRAINT unit_ownership_claim_claimant_profile_id_profile_id_fkey FOREIGN KEY (claimant_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership_claim unit_ownership_claim_resolved_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership_claim
    ADD CONSTRAINT unit_ownership_claim_resolved_by_profile_id_profile_id_fkey FOREIGN KEY (resolved_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership_claim unit_ownership_claim_source_ownership_id_unit_ownership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership_claim
    ADD CONSTRAINT unit_ownership_claim_source_ownership_id_unit_ownership_id_fkey FOREIGN KEY (source_ownership_id) REFERENCES public.unit_ownership(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership_claim unit_ownership_claim_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership_claim
    ADD CONSTRAINT unit_ownership_claim_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership unit_ownership_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership
    ADD CONSTRAINT unit_ownership_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership unit_ownership_revoked_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership
    ADD CONSTRAINT unit_ownership_revoked_by_profile_id_profile_id_fkey FOREIGN KEY (revoked_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_ownership unit_ownership_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_ownership
    ADD CONSTRAINT unit_ownership_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_progress unit_progress_current_entry_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress
    ADD CONSTRAINT unit_progress_current_entry_fkey FOREIGN KEY (current_entry_id) REFERENCES public.unit_progress_entry(id) ON DELETE SET NULL;


--
-- Name: unit_progress_entry unit_progress_entry_content_structure_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress_entry
    ADD CONSTRAINT unit_progress_entry_content_structure_node_fkey FOREIGN KEY (content_structure_node_id, unit_id) REFERENCES public.content_structure_node(id, owner_unit_id) ON DELETE RESTRICT;


--
-- Name: unit_progress_entry unit_progress_entry_content_structure_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress_entry
    ADD CONSTRAINT unit_progress_entry_content_structure_revision_fkey FOREIGN KEY (content_structure_revision_id) REFERENCES public.content_structure_revision(id) ON DELETE RESTRICT;


--
-- Name: unit_progress_entry unit_progress_entry_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress_entry
    ADD CONSTRAINT unit_progress_entry_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_progress_entry unit_progress_entry_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress_entry
    ADD CONSTRAINT unit_progress_entry_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_progress unit_progress_last_content_structure_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress
    ADD CONSTRAINT unit_progress_last_content_structure_node_fkey FOREIGN KEY (last_content_structure_node_id, unit_id) REFERENCES public.content_structure_node(id, owner_unit_id) ON DELETE RESTRICT;


--
-- Name: unit_progress unit_progress_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress
    ADD CONSTRAINT unit_progress_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_progress unit_progress_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_progress
    ADD CONSTRAINT unit_progress_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_reaction_global_stat unit_reaction_global_stat_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction_global_stat
    ADD CONSTRAINT unit_reaction_global_stat_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_reaction unit_reaction_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction
    ADD CONSTRAINT unit_reaction_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_reaction unit_reaction_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction
    ADD CONSTRAINT unit_reaction_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: unit_reaction_stat unit_reaction_stat_realm_id_realm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction_stat
    ADD CONSTRAINT unit_reaction_stat_realm_id_realm_id_fkey FOREIGN KEY (realm_id) REFERENCES public.realm(id) ON DELETE CASCADE;


--
-- Name: unit_reaction_stat unit_reaction_stat_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction_stat
    ADD CONSTRAINT unit_reaction_stat_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_reaction unit_reaction_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reaction
    ADD CONSTRAINT unit_reaction_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_reference_curation_head unit_reference_curation_head_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_reference_curation_head
    ADD CONSTRAINT unit_reference_curation_head_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_revision unit_revision_actor_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision
    ADD CONSTRAINT unit_revision_actor_profile_id_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_revision_head unit_revision_head_revision_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_head
    ADD CONSTRAINT unit_revision_head_revision_unit_fkey FOREIGN KEY (revision_id, unit_id) REFERENCES public.unit_revision(id, unit_id) ON DELETE RESTRICT;


--
-- Name: unit_revision_head unit_revision_head_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_head
    ADD CONSTRAINT unit_revision_head_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_revision unit_revision_parent_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision
    ADD CONSTRAINT unit_revision_parent_unit_fkey FOREIGN KEY (parent_revision_id, unit_id) REFERENCES public.unit_revision(id, unit_id) ON DELETE RESTRICT;


--
-- Name: unit_revision_slot unit_revision_slot_content_id_revision_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_slot
    ADD CONSTRAINT unit_revision_slot_content_id_revision_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.revision_content(id) ON DELETE RESTRICT;


--
-- Name: unit_revision_slot unit_revision_slot_origin_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_slot
    ADD CONSTRAINT unit_revision_slot_origin_unit_fkey FOREIGN KEY (origin_revision_id, unit_id) REFERENCES public.unit_revision(id, unit_id) ON DELETE RESTRICT;


--
-- Name: unit_revision_slot unit_revision_slot_revision_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_slot
    ADD CONSTRAINT unit_revision_slot_revision_unit_fkey FOREIGN KEY (revision_id, unit_id) REFERENCES public.unit_revision(id, unit_id) ON DELETE CASCADE;


--
-- Name: unit_revision_tag unit_revision_tag_revision_id_unit_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision_tag
    ADD CONSTRAINT unit_revision_tag_revision_id_unit_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.unit_revision(id) ON DELETE CASCADE;


--
-- Name: unit_revision unit_revision_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_revision
    ADD CONSTRAINT unit_revision_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_share unit_share_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_share
    ADD CONSTRAINT unit_share_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_share unit_share_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_share
    ADD CONSTRAINT unit_share_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_slug_address unit_slug_address_scope_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_slug_address
    ADD CONSTRAINT unit_slug_address_scope_unit_id_unit_id_fkey FOREIGN KEY (scope_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_slug_address unit_slug_address_target_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_slug_address
    ADD CONSTRAINT unit_slug_address_target_unit_id_unit_id_fkey FOREIGN KEY (target_unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_source_link unit_source_link_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link
    ADD CONSTRAINT unit_source_link_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: unit_source_link unit_source_link_source_entity_id_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link
    ADD CONSTRAINT unit_source_link_source_entity_id_entity_id_fkey FOREIGN KEY (source_entity_id) REFERENCES public.entity(id) ON DELETE RESTRICT;


--
-- Name: unit_source_link unit_source_link_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link
    ADD CONSTRAINT unit_source_link_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_source_link_vote unit_source_link_vote_link_id_unit_source_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link_vote
    ADD CONSTRAINT unit_source_link_vote_link_id_unit_source_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.unit_source_link(id) ON DELETE CASCADE;


--
-- Name: unit_source_link_vote unit_source_link_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link_vote
    ADD CONSTRAINT unit_source_link_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_source_link_vote_stat unit_source_link_vote_stat_link_id_unit_source_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_source_link_vote_stat
    ADD CONSTRAINT unit_source_link_vote_stat_link_id_unit_source_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.unit_source_link(id) ON DELETE CASCADE;


--
-- Name: unit_status_event unit_status_event_changed_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_status_event
    ADD CONSTRAINT unit_status_event_changed_by_profile_id_profile_id_fkey FOREIGN KEY (changed_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_status_event unit_status_event_revision_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_status_event
    ADD CONSTRAINT unit_status_event_revision_unit_fkey FOREIGN KEY (revision_id, unit_id) REFERENCES public.unit_revision(id, unit_id) ON DELETE RESTRICT;


--
-- Name: unit_status_event unit_status_event_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_status_event
    ADD CONSTRAINT unit_status_event_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_structure_application unit_structure_application_MtoBK1Ir0Rdk_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application
    ADD CONSTRAINT "unit_structure_application_MtoBK1Ir0Rdk_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: unit_structure_application unit_structure_application_structure_id_unit_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application
    ADD CONSTRAINT unit_structure_application_structure_id_unit_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.unit_structure(id) ON DELETE CASCADE;


--
-- Name: unit_structure_application unit_structure_application_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application
    ADD CONSTRAINT unit_structure_application_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_structure_application_vote unit_structure_application_vote_application_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application_vote
    ADD CONSTRAINT unit_structure_application_vote_application_fkey FOREIGN KEY (unit_id, structure_id) REFERENCES public.unit_structure_application(unit_id, structure_id) ON DELETE CASCADE;


--
-- Name: unit_structure_application_vote unit_structure_application_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application_vote
    ADD CONSTRAINT unit_structure_application_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_structure_application_vote_stat unit_structure_application_vote_stat_application_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_application_vote_stat
    ADD CONSTRAINT unit_structure_application_vote_stat_application_fkey FOREIGN KEY (unit_id, structure_id) REFERENCES public.unit_structure_application(unit_id, structure_id) ON DELETE CASCADE;


--
-- Name: unit_structure unit_structure_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure
    ADD CONSTRAINT unit_structure_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: unit_structure_edge unit_structure_edge_child_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_edge
    ADD CONSTRAINT unit_structure_edge_child_unit_id_unit_id_fkey FOREIGN KEY (child_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_structure_edge unit_structure_edge_parent_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_edge
    ADD CONSTRAINT unit_structure_edge_parent_unit_id_unit_id_fkey FOREIGN KEY (parent_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_structure_edge unit_structure_edge_structure_id_unit_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_edge
    ADD CONSTRAINT unit_structure_edge_structure_id_unit_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.unit_structure(id) ON DELETE CASCADE;


--
-- Name: unit_structure unit_structure_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure
    ADD CONSTRAINT unit_structure_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_structure_member unit_structure_member_member_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_member
    ADD CONSTRAINT unit_structure_member_member_unit_id_unit_id_fkey FOREIGN KEY (member_unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT;


--
-- Name: unit_structure_member unit_structure_member_structure_id_unit_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_member
    ADD CONSTRAINT unit_structure_member_structure_id_unit_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.unit_structure(id) ON DELETE CASCADE;


--
-- Name: unit_structure_vote unit_structure_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_vote
    ADD CONSTRAINT unit_structure_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_structure_vote_stat unit_structure_vote_stat_structure_id_unit_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_vote_stat
    ADD CONSTRAINT unit_structure_vote_stat_structure_id_unit_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.unit_structure(id) ON DELETE CASCADE;


--
-- Name: unit_structure_vote unit_structure_vote_structure_id_unit_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_structure_vote
    ADD CONSTRAINT unit_structure_vote_structure_id_unit_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.unit_structure(id) ON DELETE CASCADE;


--
-- Name: unit_tag unit_tag_created_by_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag
    ADD CONSTRAINT unit_tag_created_by_profile_id_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profile(id) ON DELETE SET NULL;


--
-- Name: unit_tag_structure_support unit_tag_structure_support_application_vote_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_structure_support
    ADD CONSTRAINT unit_tag_structure_support_application_vote_fkey FOREIGN KEY (unit_id, structure_id, profile_id) REFERENCES public.unit_structure_application_vote(unit_id, structure_id, profile_id) ON DELETE CASCADE;


--
-- Name: unit_tag_structure_support unit_tag_structure_support_member_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_structure_support
    ADD CONSTRAINT unit_tag_structure_support_member_fkey FOREIGN KEY (structure_id, tag_id) REFERENCES public.unit_structure_member(structure_id, member_unit_id) ON DELETE CASCADE;


--
-- Name: unit_tag_structure_support unit_tag_structure_support_tag_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_structure_support
    ADD CONSTRAINT unit_tag_structure_support_tag_id_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE RESTRICT;


--
-- Name: unit_tag unit_tag_tag_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag
    ADD CONSTRAINT unit_tag_tag_id_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: unit_tag unit_tag_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag
    ADD CONSTRAINT unit_tag_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_tag_vote unit_tag_vote_profile_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_vote
    ADD CONSTRAINT unit_tag_vote_profile_id_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE CASCADE;


--
-- Name: unit_tag_vote_stat unit_tag_vote_stat_effective_tag_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_vote_stat
    ADD CONSTRAINT unit_tag_vote_stat_effective_tag_fkey FOREIGN KEY (unit_id, tag_id) REFERENCES public.unit_effective_tag(unit_id, tag_id) ON DELETE CASCADE;


--
-- Name: unit_tag_vote unit_tag_vote_tag_id_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_vote
    ADD CONSTRAINT unit_tag_vote_tag_id_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: unit_tag_vote unit_tag_vote_unit_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_vote
    ADD CONSTRAINT unit_tag_vote_unit_id_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit_tag_vote unit_tag_vote_unit_tag_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_tag_vote
    ADD CONSTRAINT unit_tag_vote_unit_tag_fkey FOREIGN KEY (unit_id, tag_id) REFERENCES public.unit_tag(unit_id, tag_id) ON DELETE CASCADE;


--
-- Name: unit_variant unit_variant_main_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_variant
    ADD CONSTRAINT unit_variant_main_kind_fkey FOREIGN KEY (main_unit_id, unit_kind) REFERENCES public.unit(id, kind) ON DELETE RESTRICT;


--
-- Name: unit_variant unit_variant_variant_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_variant
    ADD CONSTRAINT unit_variant_variant_kind_fkey FOREIGN KEY (variant_unit_id, unit_kind) REFERENCES public.unit(id, kind) ON DELETE CASCADE;


--
-- Name: user_account_state user_account_state_updated_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_account_state
    ADD CONSTRAINT user_account_state_updated_by_profile_id_fkey FOREIGN KEY (updated_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT;


--
-- Name: user_account_state user_account_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_account_state
    ADD CONSTRAINT user_account_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: video video_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video
    ADD CONSTRAINT video_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: zone zone_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone
    ADD CONSTRAINT zone_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: zone_page zone_page_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_page
    ADD CONSTRAINT zone_page_id_unit_id_fkey FOREIGN KEY (id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: zone_page zone_page_zone_id_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_page
    ADD CONSTRAINT zone_page_zone_id_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(id) ON DELETE RESTRICT;


--
-- Name: zone_search_feature zone_search_feature_search_document_id_search_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_search_feature
    ADD CONSTRAINT zone_search_feature_search_document_id_search_document_id_fkey FOREIGN KEY (search_document_id) REFERENCES public.search_document(id) ON DELETE RESTRICT;


--
-- Name: zone_search_feature zone_search_feature_zone_id_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_search_feature
    ADD CONSTRAINT zone_search_feature_zone_id_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zone(id) ON DELETE CASCADE;


--
-- Name: rezics_search_projection_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION rezics_search_projection_publication WITH (publish = 'insert, update, delete, truncate');


--
-- PostgreSQL database dump complete
--
