## 1. Header Layout

- [x] 1.1 Set header height to 56px on desktop and 49px on mobile.
- [x] 1.2 Keep main layout top padding in sync with header height.
- [x] 1.3 Preserve existing drawer toggle, logo, and auth menu behavior.

## 2. Header Search Entry

- [x] 2.1 Add a header search component using existing search/navigation hooks.
- [x] 2.2 Render a desktop search input on all normal app pages.
- [x] 2.3 Render a mobile search icon on non-home pages.
- [x] 2.4 Omit the mobile header search icon on home because the home page keeps
  its existing page-level search box.
- [x] 2.5 Use rezics logo adornment for global/general search contexts.
- [x] 2.6 Use search icon plus badge text for realm/user contexts:
  - realm badge: `r/{localizedTitle}`
  - user badge: `u/{usernameOrSlug}`

## 3. Search Behavior

- [x] 3.1 Submit global/general header searches to the existing global search
  route.
- [x] 3.2 Keep realm/user header search behavior basic for this change; do not
  implement new scoped result APIs.
- [x] 3.3 Do not alter the advanced search page, Meili contracts, or index
  settings.

## 4. Validation

- [x] 4.1 Run focused frontend type/lint checks where available.
- [ ] 4.2 Manually inspect desktop/mobile header behavior if the app can run.
