## Why

The current registration flow has fragmented identity setup: slugs are assigned implicitly (derived from `user.name` or `unitId` fallback), email verification and onboarding are separate pages with separate flows for email vs OAuth users, and the header misleadingly says "Verify Email" when the real issue is incomplete registration. Users never explicitly choose their slug, and the slug can be edited later -- creating instability in user-facing URLs. The flow needs to be unified into a single, two-step registration completion page where all users (email and OAuth) explicitly confirm their identity before being provisioned.

## What Changes

- **New single "Complete Registration" page** replacing both `/verify-email` and `/onboarding` -- two sequential, interruptible, independent steps on one page
- **Step 1 (Identity):** user sets username + slug, validated for format and uniqueness against auth DB `UserProfile`. Submitting Step 1 creates `UserProfile` -- this is the lock point. No `UserProfile` = Step 1 not done.
- **Step 2 (Email Verification):** OTP + Turnstile flow for email/password users. OAuth users with trusted provider email see it as pre-verified (skip OTP). Editing a pre-verified email triggers OTP re-verification after a confirmation dialog.
- **OAuth pre-fill:** username, slug, and email are pre-filled from the third-party provider. Username and slug are freely editable (no confirmation dialog). Email edit requires a confirmation dialog warning about re-verification.
- **Slug immutability:** once `UserProfile` is created (Step 1 confirmed), the slug cannot be changed by the user -- only administrators can modify it.
- **Provisioning deferred:** user is provisioned to the main server only after **both** steps are complete (UserProfile exists AND email verified). Whichever step completes last triggers provisioning.
- **Header change:** `PendingVerificationSection` renamed/reworked to show "Complete Registration" linking to the registration page, instead of "Verify Email".
- **Browsable during registration:** users can navigate the full app as guests during any registration state. Steps are interruptible -- user can leave and return.
- **BREAKING**: `/onboarding` route removed. `/verify-email` route replaced by `/complete-registration` (or similar).
- **BREAKING**: `needsOnboarding` and `needsVerification` auth state flags replaced by a unified registration completeness model based on `UserProfile` existence + `emailVerified`.

## Capabilities

### New Capabilities
- `registration-identity-step`: Step 1 -- username and slug confirmation, UserProfile creation with uniqueness validation, slug immutability enforcement
- `registration-completion-page`: The unified single-page UI combining both steps, OAuth pre-fill behavior, interruptible flow, and completion-triggered provisioning

### Modified Capabilities
- `auth-user-provisioning-hook`: provisioning no longer fires on `user.create.after` for OAuth users -- deferred until both registration steps complete
- `exchange-auto-provision`: exchange endpoint must check both `UserProfile` existence and `emailVerified` before provisioning
- `auth-login-orchestration`: post-auth redirect logic changes from `needsOnboarding`/`needsVerification` to a single `needsRegistration` check
- `unverified-user-ux`: header prompt text changes from "Verify Email" to "Complete Registration", auth-gated action prompts updated similarly
- `app-auth-onboarding`: onboarding page removed, replaced by the registration completion page

## Impact

- **`@rezics/auth`**: `user.create.after` hook logic changes (no immediate provisioning for anyone), new endpoint or logic for Step 1 (create UserProfile with slug validation), slug immutability enforcement, provisioning trigger moves to a "both steps complete" check
- **`@rezics/server`**: provisioning endpoint conditions may change, slug update APIs restricted to admin-only
- **`@rezics/contract`**: `authSessionStateSchema` changes -- `needsOnboarding`/`needsVerification` replaced by registration completeness model, new contracts for slug validation/identity step
- **`@rezics/api`**: new query hooks for slug availability check, identity step submission
- **`@rezics/app`**: new `/complete-registration` page replacing `/verify-email` and `/onboarding`, `PendingVerificationSection` reworked, `useAuth` hook updated, `authRedirect` logic simplified
- **`@rezics/admin`**: admin UI may need slug-edit capability (existing or new)
- **Backward compatibility**: existing users with auto-generated slugs keep them. This change applies to new registrations only. No data migration required -- existing `UserProfile` records mean those users already passed "Step 1" conceptually.
