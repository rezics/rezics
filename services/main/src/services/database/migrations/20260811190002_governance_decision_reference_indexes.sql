-- atlas:txmode none

-- These relations may be corpus-scale. Partial concurrent indexes avoid a
-- table-write outage and contain only post-cutover rows with decision links.
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_account_state_decision_idx
    ON public.user_account_state (decision_id)
    WHERE decision_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS account_enforcement_action_decision_key
    ON public.account_enforcement_action (decision_id)
    WHERE decision_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS content_governance_action_decision_key
    ON public.content_governance_action (decision_id)
    WHERE decision_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_event_governance_decision_idx
    ON public.audit_event (governance_decision_id)
    WHERE governance_decision_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS unit_access_restriction_decision_idx
    ON public.unit_access_restriction (decision_id)
    WHERE decision_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unit_merge_request_decision_key
    ON public.unit_merge_request (decision_id)
    WHERE decision_id IS NOT NULL;
