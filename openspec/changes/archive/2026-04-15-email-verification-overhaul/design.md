## Context

The auth service (`package/auth`) uses better-auth 1.5.6 with URL-based email verification. When a user signs up, `sendOnSignUp: true` triggers an email containing a verification URL. Clicking it hits the auth server directly at `/api/auth/verify-email?token=xxx`, which is problematic — the user leaves the frontend context. The notification service (`package/auth/src/notification/`) uses nodemailer with minimal plaintext/HTML templates. Turnstile validation exists client-side in the app and server-side in `package/server`, but not in `package/auth`.

Unverified users currently see the full app shell with a warning banner in `MainLayout` and a `PendingVerificationSection` in the header toolbar, but cannot perform any actions since session token exchange is blocked. The `PendingVerificationSection` lacks a logout button (noted in TODO.md).

## Goals / Non-Goals

**Goals:**
- Switch to OTP-based verification that keeps users entirely in the frontend
- Gate all email sends behind server-validated Turnstile tokens
- Establish a shared email template system with branded design using react-email
- Give unverified users a clean guest-equivalent browsing experience with a non-intrusive verification prompt
- Provide admin tooling for email template preview, test sends, and SMTP diagnostics

**Non-Goals:**
- Marketing or bulk email capabilities — this is transactional email only
- Passwordless sign-in via OTP (the emailOTP plugin supports this, but we only use it for verification)
- Custom email builder UI in admin — templates are code-defined in `@rezics/email`
- Push notification or in-app notification changes (`@rezics/notify` is unaffected)

## Decisions

### 1. Use better-auth's `emailOTP` plugin instead of built-in `emailVerification`

**Choice:** Enable the `emailOTP` plugin with `overrideDefaultEmailVerification: true`.

**Why:** The plugin is purpose-built for code-based verification with rate limiting (`rateLimit`), attempt counting (`allowedAttempts: 3`), configurable code length (`otpLength: 6`), and hashed storage (`storeOTP: "hashed"`). It eliminates the callback URL problem entirely — the frontend sends the code, the auth server verifies it.

**Alternative considered:** Custom code generation + verification on top of the existing URL-based system. Rejected — reinvents what the plugin already provides, and the plugin handles edge cases (expiry, replay, rate limiting) that we'd need to build ourselves.

**Configuration:**
```
emailOTP({
  otpLength: 6,
  expiresIn: 300,              // 5 minutes
  allowedAttempts: 3,
  storeOTP: "hashed",
  sendVerificationOnSignUp: false,  // frontend-triggered
  resendStrategy: "rotate",
  sendVerificationOTP: async ({ email, otp, type }) => { ... }
})
```

### 2. Create `package/email` as a separate workspace package

**Choice:** New `@rezics/email` package containing react-email components and a render function.

**Why:** Admin needs template preview capability (import templates directly), and auth needs rendered HTML (import render function). A shared package avoids duplicating templates or creating circular dependencies. The react-email dev server also runs cleanly as a standalone package.

**Alternative considered:** Keep everything in `package/auth`. Rejected — admin would need to depend on auth (heavy, creates coupling), and the react-email dev preview server would be buried inside the auth service.

**Package structure:**
```
package/email/
├── src/
│   ├── templates/
│   │   ├── VerificationCode.tsx    # 6-digit code email
│   │   ├── PasswordReset.tsx       # Password reset link
│   │   ├── Invitation.tsx          # Org invitation
│   │   └── EmailChangeConfirm.tsx  # Email change confirmation
│   ├── components/
│   │   ├── EmailLayout.tsx         # Branded header + footer wrapper
│   │   ├── Header.tsx              # Logo + app name
│   │   └── Footer.tsx              # Copyright, links, unsubscribe
│   ├── render.ts                   # render(template) → { html, text }
│   └── index.ts                    # Public exports
├── package.json
└── tsconfig.json
```

**Dependency direction:**
- `@rezics/auth` depends on `@rezics/email` (for rendering templates)
- `@rezics/admin` depends on `@rezics/email` (for template preview/registry)
- `@rezics/email` has zero internal dependencies (only react-email)

### 3. Server-side Turnstile validation on auth service

**Choice:** Auth server validates Turnstile tokens with Cloudflare's `siteverify` API before sending any OTP email.

**Why:** Client-side-only Turnstile can be bypassed by calling the auth API directly. The existing pattern in `package/server/src/utils/turnstileUtils.ts` is straightforward (~30 lines). Copy it into auth rather than creating a shared package — both services are independent deployments and the utility is trivial.

**Flow:**
1. Frontend completes Turnstile → receives `turnstileToken`
2. Frontend calls auth endpoint with `{ email, turnstileToken }`
3. Auth validates token with Cloudflare `siteverify`
4. Only if valid → call emailOTP's `send-verification-otp`

**Implementation:** Wrap the `emailOTP/send-verification-otp` endpoint with Turnstile validation middleware, or create a custom endpoint that validates then delegates.

### 4. Unverified users browse as guests (soft prompt, no hard gate)

**Choice:** After login, auto-navigate to `/verify-email`. User can complete verification or navigate away freely. Toolbar shows compact verification prompt with logout button. No in-page banner.

**Why:** Unverified users have no session token, so they're functionally guests already. Hard-blocking them on `/verify-email` is hostile UX — they signed up to browse books, not stare at a verification wall. The soft prompt respects their agency while making verification easy to complete.

**Header states:**
```
Guest:        [Login] [Register]
Unverified:   [⚠ Verify Email] [Logout]
Verified:     [Avatar + Menu]
```

**Auth-gated action prompts:** When an unverified user tries to perform a write action (comment, react, add to readlist), show "Verify your email to..." instead of "Sign in to..." — they're already signed in, just unverified.

### 5. Provisioning hook adapts to OTP-based verification

**Choice:** Move the post-verification provisioning trigger from the URL-based `verify-email` route handler to the `emailOTP/verify-email` endpoint response handler.

**Why:** The current provisioning hook in `package/auth/src/auth/routes.ts` intercepts the `/verify-email` path. With emailOTP, the verification endpoint changes to `/email-otp/verify-email`. The `afterEmailVerification` hook on the emailOTP plugin or a response interceptor on the new path handles provisioning.

### 6. Email branding: full header/footer layout system

**Choice:** `EmailLayout` component wraps all templates with a consistent header (logo + app name) and footer (copyright, explanation line, relevant links).

**Why:** Branded emails build trust and look professional. A shared layout component in react-email ensures consistency across all templates with zero duplication.

**Logo strategy:** Host at a public URL (e.g., `https://rezics.com/logo.svg`) rather than base64 inline. Hosted images are smaller and cacheable; base64 bloats every email. Fallback to text "REZICS" if image fails to load (via alt text).

## Risks / Trade-offs

**[Risk] Existing URL-based verification tokens become invalid after deployment**
→ Acceptable. Tokens expire in 1 hour. Users who signed up but didn't verify within that window already need to request a new email. After deployment, they'll simply request an OTP code instead. No migration needed.

**[Risk] emailOTP plugin may have edge cases with better-auth's session management**
→ The plugin is well-documented and ships with better-auth. `autoSignInAfterVerification` may need to be configured at the plugin level rather than the base `emailVerification` config. Verify during implementation.

**[Risk] react-email adds a new dependency tree to the monorepo**
→ react-email is lightweight (renders to static HTML strings). It doesn't ship to the frontend bundle — only used server-side for rendering and in admin for preview. The dependency is isolated to `package/email`.

**[Risk] Turnstile secret shared across two services**
→ Both server and auth need `TURNSTILE_SECRET`. This is standard for multi-service architectures with Cloudflare. The secret is the same Cloudflare project-level secret — no additional configuration on Cloudflare's side.

**[Risk] Admin email testing could be abused to send emails to arbitrary addresses**
→ Admin endpoints are already auth-gated with admin role checks. Rate limit the test-send endpoint as additional protection.
