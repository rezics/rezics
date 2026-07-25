# Email delivery and local testing

REZICS sends email from the Bun API and background worker through Cloudflare
Email Sending's REST API. These processes are not Cloudflare Workers, so a
Workers `send_email` binding and `wrangler dev` remote binding are not part of
this application's delivery path.

## Active email purposes

Only account access and recovery email is enabled:

- email-address verification after sign-up or an explicit resend;
- password-reset links requested by the account holder.

Notification email is disabled by the shared delivery policy even when an
existing notification preference contains `email: true`. This includes replies,
new followers, direct messages, moderation updates, Realm membership updates,
system notices, and Unit access invitations. In-app notifications remain
enabled. The dormant notification-email implementation must not be enabled
until the product has reviewed its content and supplied a user-visible
preference and unsubscribe contract.

## Safe local default

`.env.example` uses:

```dotenv
EMAIL_MODE=log
EMAIL_FROM=no-reply@example.com
EMAIL_FROM_NAME=REZICS
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_EMAIL_API_TOKEN=
```

In `log` mode the normal outbox, renderer, dispatcher, and delivery-state code
run, but no message leaves the machine. Keep this mode for ordinary development
and automated tests.

## Opt-in real delivery through Cloudflare

Cloudflare requires the sending domain to use Cloudflare DNS and to be onboarded
under **Compute > Email Service > Email Sending**. `rezics.com` is currently
onboarded and enabled.

Create a narrowly scoped Cloudflare API token with **Email Sending: Edit** for
the REZICS account. Put it only in the untracked root `.env`, together with the
account ID and an address on the onboarded domain:

```dotenv
EMAIL_MODE=cloudflare
EMAIL_FROM=no-reply@rezics.com
EMAIL_FROM_NAME=REZICS
CLOUDFLARE_ACCOUNT_ID=<REZICS account ID>
CLOUDFLARE_EMAIL_API_TOKEN=<Email Sending token>
```

Then start the normal topology with `task dev`. Aspire passes the account ID and
secret token to both the API and the background worker only when
`EMAIL_MODE=cloudflare`. The worker must be running because the API writes email
intents to the database outbox; the worker renders and delivers them.

Use only a real test address you control:

1. register it to exercise email verification;
2. use **Resend verification email** to repeat the verification case;
3. use **Forgot password** to exercise password recovery;
4. inspect Email Service activity and delivery analytics in Cloudflare;
5. restore `EMAIL_MODE=log` after the test.

Remote mode sends real email. Do not use fabricated recipient domains: hard
bounces and complaints damage sender reputation and may place recipients on a
suppression list.

## Requirements before notification email can be enabled

Notification email must remain separate from marketing content and should use
an account-notification sender or subdomain distinct from any future marketing
mail. Before enabling it:

- decide which notification kinds are strictly required and which are optional;
- default optional categories off unless the user explicitly opts in;
- add a user-visible settings page with per-category controls and a global
  **Stop all optional email** action;
- add a signed, expiring preference-management link to every optional message;
- add `List-Unsubscribe` and RFC 8058 `List-Unsubscribe-Post` one-click headers
  where the message is recurring or subscription-based;
- process unsubscribe immediately and idempotently without requiring sign-in;
- preserve security-critical account email independently of optional-email
  preferences;
- keep HTML and plain-text bodies, sender identity, bounce/complaint handling,
  and deliverability monitoring complete.

Cloudflare Email Sending is for transactional email only. Any future newsletter,
promotion, or bulk campaign needs a dedicated marketing-email provider and its
own consent, suppression, and compliance design.
