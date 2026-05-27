## 1. Product Inventory And Route Structure

- [ ] 1.1 Audit `package/app/src/routes` and classify production, staff, diagnostics, and test/demo routes.
- [ ] 1.2 Remove test/demo routes from production navigation and create-menu entries.
- [ ] 1.3 Define navigation config for discovery, library, community, create, and personal areas.
- [ ] 1.4 Add route-level loading, denied, not-found, unauthenticated, and error state conventions.

## 2. Dashboard And Continuity

- [ ] 2.1 Add dashboard contract/API summary DTOs for progress, shelves, realms, notifications, DMs, drafts, activity, and safety status.
- [ ] 2.2 Implement server aggregation using existing domain services without duplicating business logic.
- [ ] 2.3 Add `@rezics/api` dashboard hooks and query keys.
- [ ] 2.4 Add `package/app/src/dashboard/` feature with page, sections, models, hooks, and components.
- [ ] 2.5 Add tests or stories for partial failure, empty user, active reader, active community member, and safety-status states.

## 3. Discovery And Detail Journeys

- [ ] 3.1 Upgrade home modules for discovery and signed-in continuation.
- [ ] 3.2 Upgrade search filters, grouped release result presentation, query-state routing, and result actions.
- [ ] 3.3 Upgrade book/entity/tag/profile/detail surfaces to expose inspect, collect, follow, discuss, contribute, report, and share actions where policy allows.
- [ ] 3.4 Add cache invalidation for collect/follow/reaction/progress actions across detail, dashboard, profile, and search cards.

## 4. Library And Reading

- [ ] 4.1 Complete shelf add/remove/reorder flows and stable user library routes.
- [ ] 4.2 Complete reading progress display and update flows across reader/detail/dashboard/profile.
- [ ] 4.3 Integrate work/release browsing from `introduce-unit-work-domain` without depending on `introduce-api-unit-store`.
- [ ] 4.4 Add tests for shelf persistence, progress update, continue reading, same-work release browsing, and standalone content.

## 5. Creation Workflows

- [ ] 5.1 Add a unified create entry flow that routes to type-specific creation features.
- [ ] 5.2 Add existing work/entity/tag/realm search steps where relevant.
- [ ] 5.3 Add draft save/recover, preview, validation, publish/submit, and post-submit next-action behavior.
- [ ] 5.4 Ensure creation features use `@rezics/contract`, `@rezics/api`, and editor primitives rather than app-local DTO copies.
- [ ] 5.5 Add tests for draft recovery, validation failure, policy denial, successful publish, and work matching.

## 6. Engagement And Inbox

- [ ] 6.1 Standardize reaction, reply, shelf/save, follow/subscribe, share, report, and DM action components.
- [ ] 6.2 Update notification feed entries with route targets and action-specific states.
- [ ] 6.3 Integrate DM entry from profile and notifications with permission checks.
- [ ] 6.4 Add report entry points backed by governance/moderation APIs.

## 7. Quality, Localization, Accessibility

- [ ] 7.1 Audit production routes for loading/empty/error/denied/not-found/unauthenticated states.
- [ ] 7.2 Add missing Traditional Chinese message keys and avoid hardcoded app copy where the i18n catalog is expected.
- [ ] 7.3 Verify app pages use Rezics design tokens, `SafeLink`, shared UI primitives, and app density.
- [ ] 7.4 Add responsive checks for dashboard, search, detail, shelf, profile, settings, and creation pages.

## 8. Verification

- [ ] 8.1 Run `bun --filter=@rezics/contract test`.
- [ ] 8.2 Run targeted `package/server` tests for dashboard and journey APIs.
- [ ] 8.3 Run targeted `package/api` tests for hooks/query keys.
- [ ] 8.4 Run targeted `package/app` tests or Storybook checks for dashboard, search, detail, shelf, creation, notification, profile, and settings flows.
- [ ] 8.5 Run `bun run check:convention`.
- [ ] 8.6 Run `bun run format:check`.
- [ ] 8.7 Run `openspec validate complete-public-app-product-experience --strict`.
