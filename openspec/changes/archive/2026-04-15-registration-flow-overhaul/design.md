## Context

Currently the registration flow is split across multiple pages and behaves differently for email vs OAuth users:

- **Email/password:** register -> unverified state -> `/verify-email` (OTP) -> provisioned to server
- **OAuth:** register -> emailVerified=true -> provisioned immediately via `user.create.after` hook -> `/onboarding` (confirm email, optional password)

Slugs are assigned implicitly from `user.name` or `unitId` fallback. The `UserProfile` table in the auth DB already has a `slug` column with a `@unique` constraint, but users never explicitly choose it. The header shows "Verify Email" for incomplete registrations, even though the real issue is broader.

The auth DB `UserProfile` is the key primitive: its **existence** signals that identity setup is complete and the slug is locked.

## Goals / Non-Goals

**Goals:**
- Unify email and OAuth registration into a single two-step flow on one page
- Make slug selection explicit and validated (format + uniqueness) at registration time
- Lock slugs permanently after confirmation (admin-only editable)
- Defer server provisioning until both steps (identity + email verification) are complete
- Allow users to browse the app freely during registration (guest-level access)
- Make steps independent and interruptible (user can do them in any order, leave and return)

**Non-Goals:**
- Migrating existing users to new slugs (existing `UserProfile` records are treated as already complete)
- Adding slug-edit UI for administrators (use existing admin capabilities or defer)
- Changing the OTP/Turnstile verification mechanism itself
- Changing password-related flows

## Decisions

### 1. UserProfile existence as the Step 1 completion signal

**Decision:** `UserProfile` row existing = Step 1 done, slug locked. No extra flags or timestamps.

**Why:** The `UserProfile` table already exists with `@unique` slug. Creating it atomically on Step 1 submission means the database constraint handles uniqueness, and the presence/absence of the row is the only state to check. Adding a `slugConfirmedAt` or status enum would be redundant complexity.

**Alternative considered:** Adding a `confirmed` boolean to `UserProfile` -- rejected because it creates a state where a profile exists but isn't confirmed, which complicates queries and the mental model.

### 2. Steps are independent and unordered

**Decision:** Step 1 (identity) and Step 2 (email verification) can be completed in any order. The registration page renders both steps and shows their completion state.

**Why:** Maximum user comfort. A user who wants to verify email first (e.g., they're unsure about their slug) should be able to. A user who wants to lock their slug immediately should be able to.

**Implication:** Provisioning checks both conditions from whichever step completes last:
- Step 1 completes last: after `UserProfile` INSERT succeeds, check `emailVerified` -> if true, provision
- Step 2 completes last: after email verified, check `UserProfile` exists -> if yes, provision

### 3. OAuth pre-fill with free editing (except email)

**Decision:** OAuth users see username, slug, and email pre-filled from the provider. Username and slug are freely editable without any confirmation dialog. Email shows as "verified by [Provider]" and editing it triggers a confirmation dialog ("changing will require re-verification"), after which it becomes a normal OTP flow.

**Why:** Username and slug are low-stakes edits -- the user just registered, nothing depends on them yet. Email is different because the provider already verified it; changing it means losing that verification.

### 4. Provisioning moved to a "both steps complete" trigger

**Decision:** Remove provisioning from `user.create.after` hook entirely. Instead, provisioning fires from whichever registration step completes last, after verifying the other step is also done.

**Implementation paths for the trigger:**
- **Auth-side:** After Step 1 (UserProfile creation), check `user.emailVerified` and provision if true. After Step 2 (email verification), check if `UserProfile` exists and provision if true. Both paths use the existing `provisionUserOnServer()` utility.
- **Fallback:** The `exchange-auto-provision` on the server side remains as a safety net -- if provisioning fails or is missed, the first token exchange will catch it (but only if both conditions are met).

### 5. Auth session state simplification

**Decision:** Replace `needsOnboarding` + `needsVerification` with a derived `registrationComplete` status based on two checks:
- `identitySet`: `UserProfile` exists for this user
- `emailVerified`: `user.emailVerified` is true

The `authSessionStateSchema` in `@rezics/contract` updates to expose these two booleans (or a single `registrationComplete` derived field). The frontend `useAuth` hook derives the header state from this.

**Why:** The current two-flag model (`needsOnboarding`, `needsVerification`) was designed for the split flow. The new unified flow only needs "is registration complete?" with optional drill-down into which step is pending.

### 6. Single route: `/complete-registration`

**Decision:** One new route replaces both `/verify-email` and `/onboarding`. The page shows both steps, marks completed ones, and adapts the UI based on auth method (email vs OAuth).

**Why:** Matches the mental model -- registration is one thing with two parts, not two separate flows. The URL also communicates the right intent to the user.

## Risks / Trade-offs

**[Slug squatting between steps]** A user could claim a desirable slug in Step 1 but never complete Step 2 (email verification), effectively squatting.
-> Mitigation: Accept this for now. Could add a TTL cleanup later (delete unverified `UserProfile` records after N days), but that's a separate concern.

**[Race condition on provisioning trigger]** If both steps complete near-simultaneously, two provisioning calls could fire.
-> Mitigation: Server provisioning endpoint already uses upsert (`ON CONFLICT DO NOTHING`). Double-fire is harmless.

**[OAuth users may not realize they need to confirm slug]** Pre-filled fields might look "done" to users who don't read carefully.
-> Mitigation: The step should clearly show a "Confirm" button and a visual indicator that submission is required. The header "Complete Registration" prompt persists until both steps are done.

**[Breaking change to routes]** `/verify-email` and `/onboarding` routes are removed.
-> Mitigation: Add redirects from old routes to `/complete-registration` for bookmarks/links. Since this is a young product, impact is minimal.

**[Existing users without UserProfile]** If any exist in production, they would appear as needing Step 1.
-> Mitigation: Check if any auth users lack a `UserProfile`. If so, backfill from current data before deploying. Likely none exist since the current flow creates profiles during provisioning.
