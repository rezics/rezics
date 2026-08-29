# Zone theme review and incident response

This runbook covers reviewed custom Zone theme revisions. All paths below are
relative to the main API prefix. Theme source and evidence are immutable; an
operator changes revision state instead of editing an accepted submission.

## Authority boundaries

- `platform.zone_theme.review` may read the bounded review queue, record
  automated evidence, decide a pending human review, and schedule contract
  revalidation batches.
- `platform.zone_theme.kill` may kill an approved revision globally. Keep this
  incident-response capability separate from routine review access.
- Theme authors need the development-preview capability and ordinary update
  permission on the `zone_theme` Unit. They cannot approve or kill revisions.

Do not grant either platform capability to a local fixture loader or a Zone
manager. Zone managers select only a currently approved revision, and showcase
fixtures must never run against staging or production.

## Normal review

1. Read `GET /zone-themes/review-queue?limit=25`, following its UUIDv7 keyset
   cursor. Never replace this with an unbounded queue read.
2. For `pending_automated`, run the transformed CSS against the fixed reference
   surfaces at 375, 768, and 1280 pixels in both light and dark schemes. Upload
   six distinct screenshot assets. Each capture must report zero contrast
   violations and layout shift at or below 0.1.
3. Record the six captures and passing AI review with
   `POST /zone-themes/:themeUnitId/revisions/:revisionId/automated-review`.
   A failure stays out of human approval; return the static or render findings
   to the author through the product's review communication surface.
4. Inspect source CSS, transformed CSS, declared assets, all six captures, and
   the AI findings. Submit `approve` or a reasoned `reject` to
   `POST /zone-themes/:themeUnitId/revisions/:revisionId/decision`.
5. Verify the returned state. Approval rechecks every declared asset in the
   decision transaction. Only `approved` revisions on the current styling
   contract with ready, public, undeleted declared assets can render. Every
   other state uses the Zone's level-1 token fallback.

## Contract-major revalidation

Deploy the renderer and new styling contract before changing revision state.
Old-contract CSS is fail-closed as soon as the deployed contract version
changes; the author grace period is only time to remediate and resubmit.

Before the 3.0.0 cutover, run
`task services-main:zone-theme-class-names:cutover-check` against staging and
production. The check is read-only and keyset-scans current localizations,
Docks, revision content, and theme source in batches. It must report no
`styleRoles` keys and no `data-style-role` selectors. If it finds any, stop the
deployment and prepare a one-time mapping to reviewed `rezics-theme-*` names;
do not add a compatibility alias.

Call `POST /zone-themes/revalidation` with the exact previous
`sourceContractVersion` and a batch limit no larger than 1,000 (250 is the
operational default). Continue from `nextCursor` until it is null. A static pass
moves a revision to `revalidation_required` on the new contract; a static or
asset failure rejects it. Every passing revision must then repeat automated and
human review before returning to `approved`.

The batch is keyset-paginated and touches only revisions on the exact source
contract version. Do not run whole-table repair SQL or reset states manually.

## Emergency kill or asset incident

1. Confirm the exact theme Unit and revision IDs, capture the incident reason,
   and check that the current state is `approved`.
2. Call `POST /zone-themes/:themeUnitId/revisions/:revisionId/kill` with a
   concise, durable reason. A killed revision cannot be approved again; a fixed
   stylesheet is a new immutable revision.
3. Verify the response state is `killed` and a Zone render projection that
   references it returns no custom stylesheet. The stored Zone reference may
   remain: token fallback is intentional and avoids an emergency cross-Zone
   rewrite.
4. If a declared image becomes private, unready, or deleted, rendering already
   fails closed on the indexed asset check. Kill the revision as well when the
   condition represents abuse or a permanent withdrawal, so the review record
   carries the incident decision.
5. Record affected revision IDs, timestamps, actor, reason, verification, and
   follow-up owner in the incident system. Never delete revision or review
   evidence as an emergency response.

Viewers can independently disable all custom Zone themes in Preferences. That
control is a viewer override, not a substitute for the global kill path.
