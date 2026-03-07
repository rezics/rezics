## 1. Contract Schemas (`package/contract/src/auth/`)

- [x] 1.1 Create `package/contract/src/auth/sign-in.ts` with Elysia `t.*` schemas for sign-in body, sign-up body, sign-out response, and auth response (user + session + token)
- [x] 1.2 Create `package/contract/src/auth/session.ts` with schemas for get-session response, list-sessions response, and revoke-session body
- [x] 1.3 Create `package/contract/src/auth/admin.ts` with schemas for list-users response (paginated), ban/unban/remove-user body, and set-role body
- [x] 1.4 Create `package/contract/src/auth/organization.ts` with schemas for create-org body, invite-member body, accept-invitation body, remove-member body, update-member-role body, list-members response, and organization detail response
- [x] 1.5 Create `package/contract/src/auth/oauth.ts` with schemas for authorize query params, token request body, token response, userinfo response, client registration body/response, and revoke body
- [x] 1.6 Update `package/contract/src/auth/index.ts` to re-export all schemas from the domain-specific files

## 2. Auth OpenAPI Router (`package/auth/src/openapi/`)

- [x] 2.1 Create `package/auth/src/openapi/sign-in.ts` with documented sign-in, sign-up, and sign-out routes using imported contract schemas, `detail` (summary, description, tags: `['Authentication']`), and handler delegating to `handleAuthRequest(request)`
- [x] 2.2 Create `package/auth/src/openapi/session.ts` with documented session routes (get-session, list-sessions, revoke-session) using contract schemas, `detail` (tags: `['Session']`), and handler delegation
- [x] 2.3 Create `package/auth/src/openapi/admin.ts` with documented admin routes (list-users, remove-user, ban-user, unban-user, set-role) using contract schemas, `detail` (tags: `['Admin']`), and handler delegation
- [x] 2.4 Create `package/auth/src/openapi/organization.ts` with documented organization routes (create, get-full-organization, invite-member, accept-invitation, remove-member, update-member-role, list-members) using contract schemas, `detail` (tags: `['Organization']`), and handler delegation
- [x] 2.5 Create `package/auth/src/openapi/oauth.ts` with documented OAuth routes (authorize, token, userinfo, revoke, jwks, register) and social provider callback route (`GET /callback/:provider`) using contract schemas, `detail` (tags: `['OAuth']`, `['Authentication']`), and handler delegation
- [x] 2.6 Create `package/auth/src/openapi/index.ts` that composes all sub-routers into a single Elysia instance with prefix `/api/auth` and adds catch-all `.all('/*', ({request}) => handleAuthRequest(request))` as the last route

## 3. Integration (`package/auth/src/index.ts`)

- [x] 3.1 Import `authOpenApiRouter` from `./openapi` in `index.ts`
- [x] 3.2 Replace `.all('/api/auth/*', ({request}) => handleAuthRequest(request))` with `.use(authOpenApiRouter)`
- [x] 3.3 Verify the `@elysiajs/openapi` plugin is mounted after the auth router so it picks up all route definitions

## 4. Validation

- [x] 4.1 Run `bun run build` (or `tsc --noEmit`) in `package/contract` to verify schema files compile
- [x] 4.2 Run `bun run build` (or `tsc --noEmit`) in `package/auth` to verify the router and integration compile
- [ ] 4.3 Start the auth server in dev mode and verify `/openapi` shows all documented auth endpoints with correct schemas, summaries, and tags
- [ ] 4.4 Verify existing auth functionality is unchanged by testing sign-in, session, and an undocumented endpoint via the catch-all
