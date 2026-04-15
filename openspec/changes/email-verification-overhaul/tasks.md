## 1. Email Template Package (`package/email`)

- [ ] 1.1 Scaffold `package/email` workspace package: `package.json` (with `react-email`, `@react-email/components` dependencies), `tsconfig.json`, `src/index.ts`
- [ ] 1.2 Create `src/components/EmailLayout.tsx` — shared layout with branded header (logo + "REZICS") and footer (copyright, explanation, links)
- [ ] 1.3 Create `src/components/Header.tsx` and `src/components/Footer.tsx` as sub-components of the layout
- [ ] 1.4 Create `src/templates/VerificationCode.tsx` — 6-digit code email with prominent code display, user greeting, instructions
- [ ] 1.5 Create `src/templates/PasswordReset.tsx` — reset link/button email wrapped in `EmailLayout`
- [ ] 1.6 Create `src/templates/Invitation.tsx` — org invitation email with inviter name, org name, accept button
- [ ] 1.7 Create `src/templates/EmailChangeConfirm.tsx` — email change confirmation with confirmation link
- [ ] 1.8 Create `src/render.ts` — `render(template, props)` function returning `{ html, text }`
- [ ] 1.9 Create `src/registry.ts` — template registry exporting template names, descriptions, and prop schemas (for admin UI)
- [ ] 1.10 Export all public APIs from `src/index.ts`
- [ ] 1.11 Verify: `bun install` resolves workspace dependency, `bun build` succeeds for `package/email`

## 2. Auth Service: emailOTP Plugin Integration

- [ ] 2.1 Add `TURNSTILE_SECRET` to `package/auth/src/env.ts` as optional string
- [ ] 2.2 Add `TURNSTILE_SECRET` to `package/auth/.env` and `.env.example` with Cloudflare test secret
- [ ] 2.3 Create `package/auth/src/utils/turnstileUtils.ts` — copy Turnstile validation utility from `package/server/src/utils/turnstileUtils.ts`, adapt to auth env
- [ ] 2.4 Add `@rezics/email` as workspace dependency in `package/auth/package.json`
- [ ] 2.5 Enable `emailOTP` plugin in `package/auth/src/auth/instance.ts`: `otpLength: 6`, `expiresIn: 300`, `allowedAttempts: 3`, `storeOTP: "hashed"`, `sendVerificationOnSignUp: false`, `resendStrategy: "rotate"`, `overrideDefaultEmailVerification: true`
- [ ] 2.6 Implement `sendVerificationOTP` callback in the plugin config: use `@rezics/email` render + notification service mailer to send branded OTP email
- [ ] 2.7 Set `emailVerification.sendOnSignUp: false` in the base better-auth config
- [ ] 2.8 Add Turnstile validation middleware/wrapper around the `/email-otp/send-verification-otp` endpoint: validate `turnstileToken` from request body before proceeding
- [ ] 2.9 Update provisioning hook in `package/auth/src/auth/routes.ts`: intercept `/email-otp/verify-email` path instead of (or in addition to) `/verify-email` for post-verification provisioning
- [ ] 2.10 Update `package/auth/src/notification/service.ts` to use `@rezics/email` templates and `render()` for all email types (verification, password reset, invitation, email change)
- [ ] 2.11 Verify: auth service starts without errors, emailOTP endpoints are registered

## 3. Auth Service: Admin Email API Endpoints

- [ ] 3.1 Create admin email API module (e.g., `package/auth/src/admin/email.api.ts`) with admin-auth-protected routes
- [ ] 3.2 Implement `GET /admin/email/templates` — returns template registry (names, descriptions, prop schemas)
- [ ] 3.3 Implement `POST /admin/email/send-test` — accepts `{ template, props, to }`, renders template via `@rezics/email`, sends via mailer
- [ ] 3.4 Implement `POST /admin/email/smtp-test` — tests SMTP connection, returns status/error details
- [ ] 3.5 Mount admin email routes in the auth server
- [ ] 3.6 Verify: admin endpoints respond correctly with auth protection

## 4. Frontend: Verify-Email Page Redesign (`package/app`)

- [ ] 4.1 Create or adopt a 6-digit OTP input component (in `package/ui` or inline in the page) — individual digit boxes, auto-advance, paste support
- [ ] 4.2 Redesign `/verify-email` page (`package/app/src/user/page/VerifyEmailPage.tsx`): two-step flow — (1) Turnstile → "Send code" button, (2) 6-digit code input → "Verify" button
- [ ] 4.3 Add logout/exit button to the verify-email page that clears auth state and redirects to homepage
- [ ] 4.4 Update API calls: replace `authApi.sendVerificationEmail` with emailOTP's `send-verification-otp` endpoint (include `turnstileToken` in request)
- [ ] 4.5 Add code verification API call: POST to `/email-otp/verify-email` with `{ email, otp }`
- [ ] 4.6 On successful verification: fetch fresh identity token, exchange for session token, navigate to app
- [ ] 4.7 Handle error states: invalid code, expired code, max attempts reached

## 5. Frontend: Unverified User UX (`package/app`)

- [ ] 5.1 Redesign `PendingVerificationSection` (`package/app/src/core/section/header/PendingVerificationSection.tsx`): compact layout with "Verify Email" button + "Logout" button, remove email display and multi-line text
- [ ] 5.2 Remove the verification banner from `MainLayout.tsx` (lines 46-63) and remove `shouldShowVerificationBanner` import/usage
- [ ] 5.3 Clean up `package/app/src/core/layout/verificationBanner.ts` (delete file if no longer referenced)
- [ ] 5.4 Update auth-gated action prompts across the app: when user is authenticated but unverified, show "Verify your email to [action]" linking to `/verify-email` instead of "Sign in to [action]"
- [ ] 5.5 Verify post-login redirect: unverified user is auto-navigated to `/verify-email` but can navigate away freely
- [ ] 5.6 Verify: unverified user can browse all public pages without restriction

## 6. Admin Dashboard: Email Testing Page (`package/admin`)

- [ ] 6.1 Add `@rezics/email` as workspace dependency in `package/admin/package.json`
- [ ] 6.2 Create email testing page route at `/admin/auth/email` (or similar under auth section)
- [ ] 6.3 Implement template picker: dropdown populated from `@rezics/email` registry or admin API
- [ ] 6.4 Implement dynamic form: renders input fields based on selected template's prop schema
- [ ] 6.5 Implement template preview: renders selected template with current form values (client-side using `@rezics/email` render)
- [ ] 6.6 Implement test send: recipient email input + send button, calls auth admin endpoint `POST /admin/email/send-test`
- [ ] 6.7 Implement SMTP diagnostics: "Test Connection" button, calls auth admin endpoint `POST /admin/email/smtp-test`, displays result
- [ ] 6.8 Add navigation link to the email testing page in the admin sidebar/nav

## 7. Cleanup and Validation

- [ ] 7.1 Remove old URL-based email verification template from `package/auth/src/notification/templates.ts` (replaced by `@rezics/email` templates)
- [ ] 7.2 Update `package/auth/.env.example` and deployment docs with `TURNSTILE_SECRET` variable
- [ ] 7.3 Verify: full signup → verify → browse flow works end-to-end (OTP-based)
- [ ] 7.4 Verify: all email templates render correctly (check react-email dev preview)
- [ ] 7.5 Verify: admin email testing page works (preview, send, SMTP test)
- [ ] 7.6 Verify: unverified user browses as guest, toolbar prompt visible, logout works
