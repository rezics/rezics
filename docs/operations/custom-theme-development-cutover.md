# Custom Theme development database cutover

The preview-only Zone-theme migration was not part of a supported release tag.
It was replaced by the generic Custom Theme model; there is no compatibility
view, API alias, or data adapter.

For a disposable development or test database that already applied
`20260826093708_zone_theme_review_pipeline.sql`, back up anything needed and
recreate the database through the repository's normal migration replay/reset
workflow. Do not run a reset against staging, production, or any database whose
data has not been explicitly declared disposable. A clean replay must apply:

```text
20260829103742_custom_theme_capability_values.sql
20260829103743_custom_theme_full_trust_external_resources.sql
```

Then run `task db:check` from the repository root to verify staged cutouts,
migration replay, canonical functions/triggers, and schema drift.

Existing CSS-only preview revisions are not migrated or approved implicitly.
Discard them in disposable environments or resubmit each as a new immutable
Custom Theme package with explicit `host_full_trust`, `external_live`, target
contract, files, remote-resource declarations, and host-scoped review. Recreate
installations only after the new revision is approved. Zone appearance tokens
remain the fallback and require no executable-theme migration.

If this old migration is ever found in a supported release tag, stop: this note
does not authorize destructive replacement of released history. Prepare a
forward migration and maintainer-approved data cutover instead.
