## 1. Auth Presence Signal

- [x] 1.1 Add contract types and any shared constants needed for the cross-site auth presence signal in `package/contract` and related auth modules.
- [x] 1.2 Update `package/auth` session handling to set a JS-readable root-domain presence cookie on successful sign-in or token bootstrap and clear it on sign-out or invalid session outcomes.
- [x] 1.3 Add targeted auth tests covering presence-cookie set/refresh/clear behavior without exposing bearer credentials.

## 2. Presence-Aware Frontend Auth Flow

- [x] 2.1 Add shared auth-presence helpers in `package/api` for reading and clearing the presence cookie from browser code.
- [x] 2.2 Update `package/api/src/react-query/jwt.ts` and `package/api/src/react-query/http.ts` so passive token bootstrap and automatic `401` retry only happen when auth presence exists.
- [x] 2.3 Update `package/app-shell/src/provider/AuthProvider.tsx` and related auth-session store paths to skip eager hydration/refresh when auth presence is absent and to fail closed on stale presence.
- [x] 2.4 Add or update focused tests for `package/api` and `package/app-shell` to cover no-presence, valid-presence, and stale-presence flows.

## 3. Cookie Consent UI

- [x] 3.1 Add a reusable cookie consent composite component in `package/ui/src/composite` with configurable copy, policy action, primary consent action, and optional secondary action.
- [x] 3.2 Export the new cookie consent component through `package/ui` barrel files and keep the API host-controlled so consuming apps manage persistence and navigation.
- [x] 3.3 Add component-level tests or fixtures validating keyboard accessibility, configurable labels, and rendered policy access.

## 4. Adoption And Validation

- [x] 4.1 Grep for existing eager auth bootstrap or cookie-consent usages across the repo and update affected imports/call sites to the new shared helpers or component exports.
- [x] 4.2 Run targeted test/build verification for changed packages (`package/auth`, `package/api`, `package/app-shell`, and `package/ui`) and fix any integration regressions.
- [x] 4.3 Confirm the OpenSpec change artifacts stay aligned with implementation scope and update task checkboxes as work lands.
