## 1. Admin Shell And Navigation

- [x] 1.1 Audit existing `package/admin/src/routes` and feature directories.
- [x] 1.2 Define navigation groups for dashboard, content, accounts, governance, search/sync, and system operations.
- [x] 1.3 Implement dashboard summary contracts/API for system status, queues, search drift, governance counts, audit, and repair warnings.
- [x] 1.4 Normalize admin page layout, table/filter/search/pagination/action patterns with compact Rezics admin density.
- [x] 1.5 Add route guards and role/capability checks for root/admin/owner-only operations.

## 2. Account Operations

- [x] 2.1 Expand auth users page with main-user linkage, role, ban/session state, enforcement summary, and reconciliation warnings.
- [x] 2.2 Expand sessions page with revoke, revoke-all, safe device metadata, and audit reason capture.
- [x] 2.3 Integrate JWT service pages into platform security navigation and add rotation/activate/deactivate controls.
- [x] 2.4 Add impersonation controls with owner-only policy, duration display, reason capture, and audit link.
- [x] 2.5 Add tests/stories for banned user, missing main profile, owner-only JWT operation, and impersonation denied states.

## 3. Content Operations

- [x] 3.1 Add cross-type Unit search/list filters by id, slug, title, type, owner, status, visibility, and drift flags.
- [x] 3.2 Normalize entity/tag/realm/shelf/source-site pages into shared content operation patterns.
- [x] 3.3 Add work/release grouping and repair surfaces when `introduce-unit-work-domain` is active.
- [x] 3.4 Add authority action forms with reason capture, impact preview, validation, and audit integration.
- [x] 3.5 Add tests/stories for empty, loading, forbidden, validation, and destructive-confirmation states.

## 4. Data Integrity And Repair

- [x] 4.1 Add admin APIs and clients for dry-run drift checks and repair jobs.
- [x] 4.2 Add repair surfaces for search projections, history outbox, work-domain membership, slugs/aliases, source-site attribution, and denormalized counters.
- [x] 4.3 Route long-running repair through job-runner or durable operation state with progress, retries, and safe failures.
- [x] 4.4 Add audit logs for repair start, retry, cancel, completion, and failure.

## 5. Observability

- [x] 5.1 Integrate system status summary into the dashboard while preserving full status page behavior.
- [x] 5.2 Expand Meili observability with index health, counts, settings, last sync, drift, and repair links.
- [x] 5.3 Add job-runner queue and failed-job panels.
- [ ] 5.4 Add Sequin/CDC and history outbox panels.
- [ ] 5.5 Ensure browser calls only Rezics typed admin APIs, never private service endpoints directly.

## 6. Governance Oversight

- [ ] 6.1 Add admin governance overview for site-wide cases, escalations, enforcement, policy exceptions, and audit summaries.
- [ ] 6.2 Keep realm day-to-day queue routes in `package/app` and link only escalated/operator-relevant items into admin.
- [ ] 6.3 Add override actions with policy authorization, reason capture, impact preview, and audit.

## 7. Verification

- [ ] 7.1 Run `bun --filter=@rezics/contract test`.
- [ ] 7.2 Run targeted `package/server` admin/diagnostic/governance/search/history tests.
- [ ] 7.3 Run targeted `package/auth` admin/JWT/session tests.
- [ ] 7.4 Run targeted `package/api` admin client/hook tests.
- [ ] 7.5 Run targeted `package/admin` route/page tests or Storybook checks.
- [ ] 7.6 Run `bun run check:convention`.
- [ ] 7.7 Run `bun run format:check`.
- [ ] 7.8 Run `openspec validate complete-admin-operations-panel --strict`.
