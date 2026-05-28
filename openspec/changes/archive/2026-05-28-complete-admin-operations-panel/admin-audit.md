# Admin Operations Audit

## Existing Route Surface

`package/admin/src/routes/_admin` currently includes:

- Dashboard and system: `/`, `/status`, `/settings`, `/misc/echokv`.
- Account/security: `/auth/users`, `/auth/sessions`, `/auth/status`,
  `/auth/email`, `/auth/jwt-services`, `/jwt-services`, `/token`.
- Content operations: `/unit`, `/unit/create`, `/unit/$unitId`,
  `/unit/work-merge`, `/book`, `/entity`, `/entity/$unitId`, `/realm`,
  `/shelf`, `/source-site`, `/source-site/$entityUnitId`, `/tag/low-score`,
  `/authority`.
- Search observability: `/meili`, `/meili/observability`, `/unit/meili`,
  `/book/meili`, `/user/meili`.
- Main user operations: `/user`, `/user/create`, `/user/$userId`.

## Existing Feature Directories

- Shell/application: `app`, `core`, `navigation`, `components`.
- Account/security: `auth`, `auth-jwt-service`, `jwt-service`, `token`, `user`.
- Content: `unit`, `book`, `entity`, `realm`, `shelf`, `source-site`, `tag`,
  `authority`.
- Observability/system: `home`, `system-health`, `meili`, `misc`.

## Gaps Against Target Console

- Navigation was resource-family oriented rather than grouped by operator job:
  content, accounts, governance, search/sync, and system operations.
- Existing dashboard shows health/stats but does not yet aggregate queue health,
  repair warnings, governance counts, audit, or search drift.
- Shared admin table/filter/bulk-action contracts are not pinned yet.
- Account pages are present but do not yet unify auth-user, main-user,
  enforcement, sessions, reconciliation, and impersonation flows.
- Data repair surfaces are partial: Meili and work-merge pages exist, but there
  is no typed repair-job contract/API surface yet.
