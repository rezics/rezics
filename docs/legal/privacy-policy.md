# REZICS Privacy Policy

Status: Draft — not effective

Draft date: 2026-08-01

> This document is a product-informed legal draft, not a published policy. It must not be treated
> as effective or linked from a production acceptance flow until the publication blockers below
> are resolved and qualified counsel has reviewed it for every launch jurisdiction.

## Publication blockers

- Replace `[OPERATOR LEGAL NAME]`, `[POSTAL ADDRESS]`, `[PRIVACY CONTACT]`,
  `[PRIVACY APPEAL CONTACT]`, `[PRIVACY REQUEST METHOD]`, `[SECURITY CONTACT]`, and
  `[DPO OR REPRESENTATIVE CONTACT]` with the data controller's identity and working request
  channels. The public project contact is currently `Edgecoordinates@gmail.com`; confirm whether
  it is authorized for any of these roles.
- Decide the minimum user age and the process for handling a user below that age. The current
  product does not collect a date of birth or implement an age-verification flow.
- Confirm every production hosting and processing country, the service-provider register, and the
  safeguards used for restricted international transfers.
- Adopt the retention periods identified by placeholders in Section 9 and implement the matching
  deletion or review jobs.
- Provide working access, correction, export, deletion, objection, and appeal request channels.
  The current product does not expose a complete self-service account deletion or data export
  flow. Implement recognition of legally binding opt-out preference signals before promising it in
  a published policy.
- Confirm whether REZICS is subject to the GDPR, UK GDPR, Taiwan Personal Data Protection Act,
  California Consumer Privacy Act, or another regional privacy regime, and add any required
  regional notice before launch there.
- Choose the effective date and material-change notice period only after the published product
  behavior matches this document.

## 1. Introduction

This Privacy Policy explains how `[OPERATOR LEGAL NAME]`, the operator of REZICS ("REZICS," "we,"
"us," or "our"), collects, uses, discloses, and retains personal data when you use REZICS websites,
applications, application programming interfaces, emails, and related services (collectively, the
"Service") or otherwise communicate with us.

REZICS is a community-driven, cross-language knowledge network for works. People can browse much
of the Service without an account. An account is required to contribute, interact, save personal
state, communicate privately, or use authenticated automation features.

This Policy is a notice about our processing practices. It is not, by itself, a request for consent.
Where consent is the appropriate legal basis, we will ask for it separately and provide a way to
withdraw it.

## 2. The public nature of REZICS

REZICS is designed to make public knowledge, discussions, and works discoverable across languages.
Depending on the resource and the visibility settings selected, the following may be public:

- your Profile address, public name, biography, avatar, banner, and other public Profile fields;
- Posts, Replies, Reviews, Wiki contributions, titles, descriptions, metadata, media, source links,
  tags, structures, and other content you publish;
- attribution, revision, publication, contribution, and governance history connected to public
  content;
- public follows, reactions, scores, or Progress when the relevant feature and your visibility
  settings make them public; and
- the date and time associated with public activity.

Public information can be viewed without an account, indexed by search engines, accessed through
authorized APIs, quoted or reshared by other people, archived by third parties, or incorporated
into systems outside our control. Removing content from REZICS does not necessarily remove copies
already made by other people or services. Consider this before publishing personal or sensitive
information.

Private messages, account email addresses, credentials, unpublished content, reports, moderation
notes, and resources marked private are not made public by us merely because they are stored on the
Service. Authorized recipients, community managers, or platform personnel may nevertheless access
them where the feature requires it, as explained below.

## 3. Personal data we collect

### 3.1 Data you provide or generate through account features

| Category                              | Examples in the current Service                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account and authentication data       | Email address, account name, password verifier, email-verification state, registration content language, verification and password-reset records, session credentials, and API-token name, prefix, permissions, limits, and expiry. The full API-token secret is returned once; the stored credential is hashed. |
| Profile and preference data           | Public Profile fields and media, Profile address, interface and preferred content languages, content ratings, default License selections, feed-personalization setting, privacy settings, notification settings, blocked Profiles, and source preferences.                                                      |
| Public content and metadata           | Posts, Replies, Reviews, Wiki content, Units, localizations, titles, summaries, descriptions, Portable Text, images, links, tags, structures, variants, License choices, and contribution or revision history.                                                                                       |
| Non-public content and communications | Direct messages, unpublished or private resources, reports, ownership claims, access invitations, support requests, and communications with us or authorized community managers.                                                                                                                                 |
| Activity and relationship data        | Follows, favorites, collections, reactions, shares, votes, rule acknowledgements, membership, access grants, notification state, scores, Progress entries, completion state, and content exclusions.                                                                                                             |
| Governance and safety data            | Reports and their evidence, moderation actions and notes, account or community enforcement, appeals or reversals, access decisions, security audit events, and identifiers needed to explain those decisions.                                                                                                    |
| Future transaction data               | If paid functionality is introduced, purchase, entitlement, payout, tax, refund, and transaction records described in the applicable payment or monetization terms. REZICS must update this Policy and identify the payment providers before collecting this data.                                               |

You may choose not to provide optional data. If data is required to create an account, secure the
Service, perform a requested feature, or comply with law, declining to provide it may prevent us
from offering that feature.

### 3.2 Data collected when you use the Service

We and our infrastructure providers may process:

- network and request data, such as IP address, request time, request method, route, response
  status, referrer, and traffic-routing information;
- browser and device data, such as user-agent string, browser type, operating system, language,
  device settings, and capabilities needed to render or protect the Service;
- session data, including session identifier, creation and expiry time, IP address, and user agent;
- recommendation events, including the recommendation surface, target Unit, display position,
  policy version, pseudonymous request identifier, impression, open, dwell threshold, or
  "not interested" action;
- use of authenticated API features, including the account and token involved, permissions,
  quota counters, concurrency leases, last-request time, and operation-level limits;
- security, reliability, and diagnostic data, including rate-limit decisions, abuse signals,
  dependency health, traces, metrics, and redacted structured logs; and
- approximate location that can be inferred from an IP address by network or security providers.
  The current Service does not ask for or intentionally collect precise device location.

The current observability design excludes request and response bodies, raw URL queries, SQL
statements, credentials, email addresses, and business identifiers from exported traces and
metrics. Structured logging applies redaction to credentials and identifiers. This is a technical
safeguard, not a promise that no personal data can ever appear in an error or security record.

### 3.3 Data from other people and sources

We may receive personal data about you from:

- another user who mentions, attributes, invites, reports, messages, blocks, follows, or submits
  an ownership claim involving you;
- a person acting for a business, organization, Realm, Zone, or Unit who grants or revokes access;
- public sources and source links used to describe or verify works, people, organizations,
  authorship, ownership, or other Units;
- security and infrastructure providers that return bot, fraud, delivery, or abuse signals; and
- a third-party service you deliberately contact through a link, embedded feature, or integration.

Do not provide another person's non-public personal data unless you are authorized to do so and
the disclosure is necessary for the feature you are using.

## 4. Cookies, local storage, and similar technology

The current Service uses the following technology:

- **Essential authentication cookies** keep you signed in and protect authenticated requests.
  Rejecting them prevents account features from working.
- **Preference storage** remembers theme, sidebar layout, expanded navigation groups, and recently
  selected avatar emoji. Most of this data remains in your browser's local storage; a layout
  preference may use a first-party cookie.
- **Application cache and service worker storage** keep versioned static application assets and an
  offline page available. The progressive web app does not intentionally cache API responses,
  React Server Component responses, or page data for offline use.
- **Cloudflare Turnstile** runs during email registration to detect automated abuse. Its browser
  code processes device and browser signals and returns a short-lived verification token that our
  server validates with Cloudflare. Cloudflare may expose aggregate challenge analytics such as
  browser, country, user agent, autonomous system, and source IP. See Cloudflare's
  [Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/).

At the Draft Date, REZICS does not use third-party behavioral advertising cookies or a third-party
browser analytics SDK. We do not respond to legacy "Do Not Track" signals because there is no
accepted technical standard for them. Where applicable law requires recognition of an opt-out
preference signal, such as Global Privacy Control, we will honor it for the processing to which it
legally applies.

You can remove first-party cookies, local storage, and cached assets through your browser. Doing so
may sign you out, reset preferences, or remove offline functionality.

## 5. How and why we use personal data

We use personal data only for defined purposes. The legal bases below apply where a law such as the
GDPR requires us to identify one; the correct basis may depend on the feature and your location.

| Purpose                                                     | Typical data                                                                                                                        | Typical legal basis                                                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Provide accounts and requested features                     | Account, Profile, content, messages, preferences, interactions, API credentials, and transaction data                               | Perform our contract with you; take steps you request before entering a contract                                              |
| Publish and distribute content as directed                  | Public content, Profile attribution, visibility choices, and license records                                                        | Perform our contract with you; your direction to make data public                                                             |
| Personalize language, feeds, discovery, and recommendations | Preferences, follows, collections, reactions, scores, Progress, recommendation events, and content relationships                    | Our legitimate interest in making the Service relevant; consent where required                                                |
| Protect accounts and the Service                            | Session and network data, credentials, Turnstile results, quota state, reports, enforcement, audit events, and redacted diagnostics | Our legitimate interests in security, fraud prevention, abuse prevention, and enforcing the User Agreement; legal obligations |
| Operate search, storage, delivery, and reliability systems  | Public content, metadata, media, search indexes, request data, traces, metrics, and backups                                         | Perform our contract; our legitimate interest in operating and improving a reliable Service                                   |
| Communicate with you                                        | Email address, locale, verification or recovery link, support correspondence, and notification preferences                          | Perform our contract for account and security mail; consent for optional communications where required                        |
| Moderate communities and resolve disputes                   | Reports, relevant content, messages supplied with a report, moderation history, ownership claims, access history, and audit records | Perform our contract; our legitimate interests in safe and accountable governance; legal obligations                          |
| Comply with law and protect rights                          | Any data reasonably necessary for a valid request, emergency, claim, investigation, or compliance record                            | Legal obligation, vital interests, or legitimate interests in establishing and defending legal claims                         |
| Analyze and improve the Service                             | Aggregated usage, redacted diagnostics, recommendation effectiveness, and feature performance                                       | Our legitimate interest in improving the Service; consent where required                                                      |

We do not use content covered by the
[REZICS Unit Content License 1.0](./rezics-unit-content-license-v1.md) to train a general-purpose
artificial intelligence or machine-learning model. We also do not use other user content for that
purpose unless the affected rights holder separately and affirmatively agrees to terms that clearly
authorize it. Search indexing, recommendations, spam detection, accessibility, and other
Service-specific analysis are not general-purpose model training.

## 6. Personalization and automated processing

If personalized feeds are enabled, REZICS may use your language choices, follows, collections,
reactions, scores, Progress, exclusions, and interactions with recommendations to rank or select
content. It may also derive weighted interests in Units from this activity. You can disable the
personalized feed in your preferences and remove specific recommendations through available
controls. Aggregated popularity and structural relationships may still affect non-personalized
ordering.

Automated systems also help detect abuse, enforce rate limits, validate credentials, and prioritize
material for human or community review. The current Service does not use solely automated
processing to make a decision that produces legal or similarly significant effects about you. If
that changes, we will explain the logic, likely consequences, and available human review before the
processing begins where required by law.

## 7. How we disclose personal data

We may disclose personal data in the following circumstances:

- **At your direction or as part of a public feature.** We publish data you submit to a public
  resource and provide it to people or API clients who request that resource.
- **To other users and authorized community managers.** We disclose data needed to deliver direct
  messages, invitations, reports, membership, collaboration, moderation, ownership, and access
  workflows. Access is limited by the relevant feature and permissions.
- **To service providers.** Providers may process data for edge delivery, hosting, networking,
  database infrastructure, object storage, search, email delivery, bot protection, monitoring,
  backups, and support. They may process data only to provide the contracted service, subject to
  appropriate terms and safeguards.
- **To third-party services you choose.** Opening an external link or using a third-party feature
  sends data such as your IP address, user agent, and referring page to that provider. For example,
  a configured Font Awesome Kit supplies icon styles, and the avatar icon picker queries Font
  Awesome's public metadata API when you use it. See
  [Font Awesome's privacy policy](https://fontawesome.com/privacy).
- **For legal compliance.** We may disclose data when reasonably necessary to comply with
  applicable law, regulation, court order, or valid legal process. Where lawful and appropriate, we
  will seek to narrow the request and notify the affected person before disclosure.
- **For safety and enforcement.** We may disclose data when reasonably necessary to investigate
  fraud or abuse, enforce our terms, protect the security or rights of REZICS and others, or prevent
  imminent serious harm.
- **For a change in control.** Data may be disclosed as part of due diligence or transferred in a
  merger, financing, acquisition, reorganization, insolvency, or sale of all or part of the Service,
  subject to confidentiality and applicable notice requirements.
- **In aggregated or de-identified form.** We may publish or disclose information that does not
  reasonably identify an individual. We will not attempt to re-identify it except to test the
  effectiveness of de-identification safeguards.

The production architecture documented in this repository uses Cloudflare for the public web edge,
static-site delivery, object storage, Turnstile, and transactional email delivery. Cloudflare may
process end-user IP addresses, traffic-routing data, browser signals, uploaded media, email
delivery data, and other data necessary for those services. See
[Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/).

At the Draft Date, REZICS does not sell personal data, share it for cross-context behavioral
advertising, or use it to serve personalized advertising. We must update this Policy, provide any
required opt-out mechanism, and give notice before beginning any such practice.

## 8. International data transfers

REZICS is accessible internationally. Personal data may be processed in `[HOSTING COUNTRIES]` and
in countries where our service providers operate. Those countries may have privacy laws different
from the laws where you live.

Before publication, REZICS must document each production transfer and identify the applicable
safeguard, such as an adequacy decision, approved contractual clauses, or another lawful transfer
mechanism. Contact `[PRIVACY CONTACT]` to request information about safeguards relevant to your
data.

## 9. Retention

We retain personal data only for as long as needed for the purposes described in this Policy,
including providing the Service, maintaining security and integrity, resolving disputes,
preserving licensed or public content history, and complying with legal obligations. The following
periods must be finalized before publication:

| Data                                                      | Draft retention rule                                                                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account and Profile data                                  | While the account is active, then `[ACCOUNT RETENTION PERIOD]`, except for data retained under another rule below                                                                                                        |
| Sessions and verification records                         | Until expiry or revocation, then `[SESSION AND VERIFICATION CLEANUP PERIOD]`                                                                                                                                             |
| Authentication email outbox data                          | Until delivery succeeds or permanently fails, then `[EMAIL DELIVERY RETENTION PERIOD]`; the current outbox clears the recipient address and action URL after provider acceptance                                         |
| API-token metadata and quota records                      | Until revocation or expiry, then `[API CREDENTIAL RETENTION PERIOD]`; the secret itself is stored as a hash                                                                                                              |
| Private messages and non-public content                   | Until deleted by an available feature or a valid request, then `[PRIVATE CONTENT RETENTION PERIOD]`, subject to reports, safety holds, and backups                                                                       |
| Public content and revision history                       | While published or needed to preserve attribution, content integrity, and License records; after removal, according to each applicable License and `[PUBLIC CONTENT RETENTION PERIOD]` |
| Recommendation events and inferred interests              | `[RECOMMENDATION EVENT RETENTION PERIOD]`; aggregate statistics may be kept longer when they no longer identify a person                                                                                                 |
| Reports, governance, enforcement, and security audit data | `[GOVERNANCE AND AUDIT RETENTION PERIOD]`, based on safety, appeal, repeat-abuse, and accountability needs                                                                                                               |
| Application logs, traces, and metrics                     | `[OBSERVABILITY RETENTION PERIOD]`                                                                                                                                                                                       |
| Backups and caches                                        | Until overwritten on the documented cycle, no longer than `[BACKUP RETENTION PERIOD]`, unless a legal hold applies                                                                                                       |

Deletion may be delayed where data is needed to comply with law, preserve evidence, protect the
Service or another person, exercise or defend legal claims, complete a transaction, or honor a
license or access right that survives removal. Access to retained data remains restricted to the
applicable purpose.

## 10. Security

We use technical and organizational safeguards appropriate to the nature of the data and the risks
of processing. Current measures include HTTPS in transit, hashed passwords and API credentials,
first-party session cookies, scoped API permissions and quotas, object-level authorization,
restricted administrative capabilities, append-only security auditing for high-impact actions,
redaction of observability data, and separation between public and non-public resources.

No method of transmission or storage is completely secure. You are responsible for using a unique
password, protecting API tokens and account access, reviewing active sessions, and promptly
contacting `[SECURITY CONTACT]` if you suspect unauthorized access. Do not send passwords, session
cookies, API-token secrets, or recovery links by email.

## 11. Your rights and choices

Subject to applicable law and appropriate identity verification, you may have the right to:

- know whether and why we process your personal data and obtain a copy;
- correct inaccurate or incomplete personal data;
- delete personal data;
- restrict or object to certain processing;
- receive data you provided in a portable format;
- withdraw consent without affecting processing already performed lawfully;
- opt out of a sale, targeted advertising, or certain profiling if we ever conduct such processing;
- appeal our refusal of a privacy request where local law provides that right; and
- complain to your local data-protection or consumer-protection authority.

You can already change some Profile data, preferences, score and Progress visibility, notification
settings, sessions, and API tokens through the Service. Submit other requests through
`[PRIVACY REQUEST METHOD]`. We may ask you to authenticate or verify control of your account email.
An authorized agent must provide evidence of authority, and we may still verify the request with
you directly where permitted.

Rights are not absolute. For example, we may decline to delete data we must keep by law, need for a
legal claim, or retain under a valid content license. We will explain an applicable exception unless
law prevents us from doing so. We will not discriminate against you for exercising a privacy right.

### Account deletion and public content

Deleting an account and deleting public contributions are different operations. Before requesting
account deletion, remove content you do not want to remain public where the Service provides that
control. Public contributions, revision attribution, governance history, and licensed content may
remain where necessary to preserve community knowledge, other users' contributions, legal records,
or rights granted under a selected public license or the REZICS Unit Content License. Where
possible and legally appropriate, remaining content will be disassociated from account data that
is no longer necessary.

## 12. Children

The Service is not directed to children below `[MINIMUM AGE]`, and they may not create or use an
account. A person must also meet any higher minimum age required in their country. If a person is
old enough to use the Service but not old enough to enter a binding contract, their parent or legal
guardian must review and agree to the User Agreement where local law permits that approach.

We do not knowingly collect personal data from a child who is not eligible to use the Service. If
you believe an ineligible child has provided personal data, contact `[PRIVACY CONTACT]`. After
appropriate verification, we will take steps required by law, which may include deleting the data
and closing the account.

## 13. Changes to this Policy

We may update this Policy to reflect changes in the Service, our processing, or applicable law. We
will post the revised Policy and change its effective date. For a material change, we will provide
notice through the Service or by email at least `[MATERIAL CHANGE NOTICE PERIOD]` before it takes
effect unless a shorter period is necessary for security, safety, or legal compliance. Where the
law requires consent for a new purpose, notice alone will not replace that consent.

## 14. Contact

The data controller for the Service is:

`[OPERATOR LEGAL NAME]`  
`[POSTAL ADDRESS]`  
Privacy requests: `[PRIVACY CONTACT]`  
Data protection officer or representative, if applicable: `[DPO OR REPRESENTATIVE CONTACT]`

If we deny a privacy request, you may appeal by contacting `[PRIVACY APPEAL CONTACT]` and stating
that your message is a privacy appeal.

---

## Drafting references — remove before publication

This draft uses the information architecture of the
[Reddit Privacy Policy](https://www.reddit.com/policies/privacy-policy), but its factual statements
were written from REZICS's current code and architecture rather than copied from Reddit. It also
accounts for the disclosure categories identified by the
[European Commission's GDPR guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en),
[Article 8 of Taiwan's Personal Data Protection Act](https://www.pdpc.gov.tw/en/News_Content/165/804/),
the [California Attorney General's privacy-policy guidance](https://oag.ca.gov/privacy/facts/online-privacy/privacy-policy),
and the [FTC's COPPA guidance](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy).
