# Cloudflare Turnstile

REZICS protects only email registration (`POST /api/auth/sign-up/email`) with a
Cloudflare Turnstile Managed Widget. The browser obtains a short-lived token and
sends it in `x-captcha-response`; the existing Bun/Better Auth service validates
that token directly with Cloudflare Siteverify. No verification Worker is part of
this deployment.

## Environment contract

Local development uses Cloudflare's documented always-pass test pair from
`.env.example`. Production must replace all three values:

```dotenv
TURNSTILE_SITE_KEY=<managed-widget-site-key>
TURNSTILE_SECRET_KEY=<managed-widget-secret-key>
TURNSTILE_ALLOWED_HOSTNAMES=rezics.com
```

`TURNSTILE_SITE_KEY` is public and is passed from the server layout to the
registration UI. `TURNSTILE_SECRET_KEY` is server-only and must be injected from
the deployment secret store. When a public hostname is configured, startup
rejects Cloudflare's test site key and test secret. A deployment accidentally
left with local allowed hostnames remains fail-closed because Siteverify's
production hostname cannot pass the backend allowlist.

With the official test secret, development still calls Cloudflare Siteverify but
does not require action or hostname metadata: Cloudflare's dummy success response
does not provide the production widget metadata. This exception requires both the
official test secret and `REZICS_RELEASE=development`; real credentials and all
released environments keep the full action and hostname checks.

## Production widget

Create one Managed Widget in the REZICS Cloudflare account:

- Name: `REZICS account registration`
- Mode: `Managed`
- Hostname: `rezics.com`
- Pre-clearance: disabled

Do not add `localhost` or `127.0.0.1` to the production Widget. Use the official
test pair for local development and automated tests instead.

The frontend renders the Widget explicitly because the registration dialog is
dynamic. It uses action `turnstile-spin-v1`, disables Turnstile's hidden form
field, and passes the token only through Better Auth's request header. The backend
accepts real-widget tokens only when Siteverify reports that same action and an
allowed hostname. Tokens are discarded after expiry, challenge errors, and every
failed registration attempt.

If a Content Security Policy is introduced, allow
`https://challenges.cloudflare.com` in the directives required by the current
Cloudflare Turnstile CSP guidance. Monitor Turnstile Analytics after rollout and
rotate the secret through Cloudflare plus the deployment secret store when
credentials may have been exposed.
