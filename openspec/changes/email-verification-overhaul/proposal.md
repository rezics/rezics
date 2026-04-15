## Why

The current email verification flow has several UX and security shortcomings. Verification emails use URL-based tokens that redirect through the auth server instead of keeping users in the frontend. The email templates are minimal plaintext/HTML with no branding. Unverified users land in an awkward half-state — they can see the app shell but every API call fails because no session token is issued. The `PendingVerificationSection` in the header lacks a logout button and has poor styling. Additionally, Turnstile verification only happens client-side with no server-side validation, and there is no admin tooling for testing email delivery.

## What Changes

- **Switch from URL-based to OTP-based email verification** using better-auth's `emailOTP` plugin (6-digit codes, 5-minute expiry, rate-limited, attempt-limited)
- **Disable auto-send on signup** — verification email is frontend-triggered after Turnstile completion (two explicit steps: prove you're human, then receive a code)
- **Add server-side Turnstile validation** on the auth server — frontend sends `turnstileToken`, auth validates with Cloudflare before sending OTP
- **Introduce `@rezics/email` package** with react-email for branded HTML email templates (shared layout with logo header + footer)
- **Redesign all transactional email templates** — verification code, password reset, invitation, email change confirmation — using the new branded layout
- **Redesign `PendingVerificationSection`** — compact toolbar prompt with "Verify Email" action + logout button; remove the in-page banner from `MainLayout`
- **Treat unverified users as guests** — full browsing capability, no hard gate; auth-gated actions show "verify your email to..." instead of "sign in to..."
- **Redesign `/verify-email` page** — code input UI (6-digit), Turnstile-gated send, logout/exit button
- **Add admin email testing page** — template preview, test send to any address, SMTP connection diagnostics

## Capabilities

### New Capabilities
- `email-templates`: react-email package (`@rezics/email`) with branded layout, shared header/footer, and templates for all transactional emails
- `email-otp-verification`: OTP-based email verification using better-auth's emailOTP plugin with server-side Turnstile validation
- `admin-email-testing`: Admin dashboard page for previewing email templates, sending test emails, and SMTP diagnostics
- `unverified-user-ux`: Soft verification prompt — unverified users browse as guests, toolbar nudge to verify, logout capability, "verify to..." prompts on auth-gated actions

### Modified Capabilities
- `email-verification-gate`: Provisioning gate must work with the new OTP-based verification flow instead of URL-based tokens
- `auth-login-orchestration`: Post-login redirect auto-navigates to `/verify-email` but no hard lock; unverified users can navigate away freely

## Impact

**Affected packages:**
- `package/email` (new) — react-email templates and rendering
- `package/auth` — emailOTP plugin integration, Turnstile server-side validation, notification service refactor to use `@rezics/email` for rendering
- `package/app` — `/verify-email` page redesign (code input), `PendingVerificationSection` redesign (compact + logout), remove `MainLayout` banner, auth-gated action prompts
- `package/admin` — new email testing page (template preview + test send + SMTP diagnostics)
- `package/ui` — possible shared OTP input component

**New dependencies:**
- `react-email` + `@react-email/components` in `package/email`

**Environment:**
- `TURNSTILE_SECRET` added to `package/auth` env schema and `.env`

**Backward compatibility:**
- Users with pending URL-based verification tokens will need to request a new OTP code after deployment — existing tokens become invalid. This is acceptable since tokens expire in 1 hour anyway.
- No database schema changes required — better-auth's emailOTP plugin uses its own verification table.
