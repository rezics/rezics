---
title: Replace Dashboard With Profile Progress Tab
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [app, progress, dashboard, profile, i18n]
---

## Why

The signed-in dashboard duplicates progress/library surfaces that now belong more naturally under the user's profile. Home currently imports dashboard components just to render continuation content, and `/u/me/progress` already has a progress-owned library page that overlaps with the dashboard library section.

Move the useful continuation and progress UI into the `progress` feature, expose it as a current-user `Progress` tab on profile routes such as `/u/root-user/progress`, fix the chapter-count interpolation bug, and remove the redundant app dashboard page/route/components once no caller depends on them.

## Durable constraints & decisions

- `(comment)` Progress profile data remains viewer-owned for this change. Do not expose another user's reading progress through `/u/$userSlug/progress` unless a deliberate public progress API and privacy decision are added later.
- `(test)` The profile tab list only includes `Progress` for the current user; other user profiles must not route users into a private `/me` progress surface.
- `(test)` Home's signed-in continuation block must render continue-reading content without importing from `@/dashboard` or linking to `/u/me/dashboard`.
- `(test)` Chapter progress labels interpolate with the repo's i18n runtime placeholder style, so `{completed}` and `{total}` render numeric values instead of literal braces.
- `(type)` Continue-reading response shape belongs to progress contracts/API after this change; dashboard-specific aggregate types should not remain the owner of `ContinueReadingItem`.
- `(comment)` Resume routes for progress rows stay anchored to the exact touched unit, including variants; keep the existing progress service invariant when moving or reusing library/continuation logic.
- `(test)` Removing dashboard must leave no generated route/import references to `/u/me/dashboard` and no app import path from home/progress/profile to `@/dashboard`.

## 1. Move continuation contracts and API ownership

- [ ] 1.1 Move `ContinueReadingItem`, `ResumeRoute`, and related schema/type exports from `package/contract/src/dashboard/dashboard.ts` into progress-owned contract files near `package/contract/src/shelf/progress.ts`, preserving the existing response shape.
- [ ] 1.2 Add a progress-owned continue-reading response/query contract for the current user, reusing read-language query fields.
- [ ] 1.3 Move the server continue-reading repository/service logic from `package/server/src/dashboard/dashboard.service.ts` into `package/server/src/progress/progress.service.ts` or a progress-local helper, keeping chapter total/completed counting behavior intact.
- [ ] 1.4 Add a progress API endpoint in `package/server/src/progress/progress.api.ts` for `/me/progress/continue-reading` with the new contract response.
- [ ] 1.5 Add frontend API/query wrappers in `package/api/src/progress/progress.api.ts`, `progress.keys.ts`, and `progress.queries.ts`.
- [ ] 1.6 Add or move tests covering continue-reading progress ratio/resume route behavior and the new progress API/query boundary.

## 2. Build the profile progress tab

- [ ] 2.1 Replace `package/app/src/progress/pages/ProgressLibraryPage.tsx` with a full progress tab/page composition: continue-reading first, then progress overview/status areas, then library grid.
- [ ] 2.2 Keep the existing bookshelf grid behavior and URL column override support by reusing `BookshelfGrid`, `resolveBookshelfConfig`, and `UseMySettingsButton`.
- [ ] 2.3 Add progress status summaries from the loaded library/progress rows using `UserUnitProgressStatus` values: `ACTIVE`, `BACKLOG`, `PAUSED`, `COMPLETED`, `DROPPED`.
- [ ] 2.4 Add `package/app/src/routes/_mainLayout/u/$userSlug/progress.tsx` that renders the progress page only for `isCurrentUser`; non-current profiles should not show private progress data.
- [ ] 2.5 Update `package/app/src/user/components/ProfileTabBar.tsx` and supporting profile context props so the `Progress` tab is present only for the current user.
- [ ] 2.6 Update route generation expectations by running the repo's route generation task if required by the existing TanStack route workflow.

## 3. Detach home from dashboard

- [ ] 3.1 Move `ContinueReadingSection`, `continueReadingProgress`, and `resumeRouteToHref` from `package/app/src/dashboard` into `package/app/src/progress`.
- [ ] 3.2 Update `package/app/src/home/sections/HomeContinuationSection.tsx` to call the progress continue-reading query and render only the continuation section.
- [ ] 3.3 Change the home continuation link target and i18n copy from dashboard language to the new progress tab route.
- [ ] 3.4 Remove home's dashboard-only shelves/realms continuation content; those areas remain outside the signed-in continuation block.

## 4. Fix i18n placeholders and labels

- [ ] 4.1 Change `dashboard_chapters_progress` or its replacement key in every `package/i18n/locales/*/page.json` from `{{completed}} / {{total}} ...` to `{completed} / {total} ...`.
- [ ] 4.2 Add progress/profile tab labels in every `package/i18n/locales/*/settings.json` or the namespace chosen by nearby profile tabs.
- [ ] 4.3 Replace hardcoded Progress page strings and empty states with i18n keys.
- [ ] 4.4 Add or update i18n/runtime tests if an existing locale interpolation test can cheaply lock the placeholder format.

## 5. Remove dashboard surface

- [ ] 5.1 Delete `package/app/src/routes/_mainLayout/u/me/dashboard.tsx` and regenerate `package/app/src/routeTree.gen.ts`.
- [ ] 5.2 Delete dashboard page/section/component/story files that have no remaining callers, including `DashboardPage`, `DashboardLibrarySection`, `DashboardDraftsSection`, `ShelvesSection`, `RealmsSection`, `SafetySection`, and `DashboardSection` if unused.
- [ ] 5.3 Remove `package/app/src/dashboard/index.ts` exports once all imports have moved to `progress`.
- [ ] 5.4 Remove or simplify `@rezics/api/dashboard` and server dashboard summary code only after confirming no app/admin caller still uses `/me/dashboard`.
- [ ] 5.5 Update cache coherence references so progress mutations invalidate progress/profile surfaces without preserving dashboard invalidations that no longer exist.
- [ ] 5.6 Run focused tests for progress/dashboard/home/profile, then `task check:convention` and route/type checks as needed.

## Out of scope

- Public progress pages for other users.
- New privacy settings for reading progress.
- Reworking shelves, realms, drafts, notifications, or safety into replacement dashboard sections.
- Visual redesign of the whole profile page outside the new progress tab.
