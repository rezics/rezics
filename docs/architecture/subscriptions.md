# Subscribe, plans and independent entitlements

Status: selected target contract, September 15, 2026. Runtime activation and
qualification belong to [M10](../plan/modules/subscriptions-and-pro.md), outside
the current IAM implementation scope. This document specifies required behavior;
it does not claim a billing integration or new authorization audience exists.

Subscribe is a native capability for eligible People/Entities, Realms and other
registered resource owners. Multiple plans are part of its first implementation.
[Realm participation policies](realm-participation-policies.md) owns quotas,
review and the first Rezics Pro experience. [Identity/access](identity-and-access.md)
continues to own actual authority. [Capacity](subscriptions-capacity.md) and
[acceptance](../testing/subscriptions-and-pro.md) cover their composition.

## Product contract

Users can discover an offering, compare plans, purchase and manage subscriptions,
and receive independent complimentary or contributor benefits. Operators can
offer plans against resources they are authorized to operate. A subscribed Person
need not manufacture a Realm; a community can compose Subscribe with a Realm.

The subscription target, seller/operator, payer, beneficiary and resources covered
by benefits are distinct identities. A creator's plan can include that creator's
selected publications and an authorized discussion space without selling access
to everything associated with the creator. Attribution, catalog affiliation and
matching names do not establish offering authority.

Follow, notification preferences, Realm membership, friendship, commercial
subscriptions and entitlements retain separate lifecycles. One user journey may
orchestrate them with explicit consent; none is an implicit writable copy of another.
Buying access does not subscribe to every notification or expose a member roster.

### Information indexes and verification services

[Information verification](information-indexing-and-verification.md#commercial-boundary)
defines candidate offerings for operated quality indexes, detailed evidence analysis,
update tracking and bounded verification allocations. These use the same registered
target/benefit contracts without requiring a Realm. Index operators, evaluators,
source owners and sellers are distinct; cross-owner benefits require approval.

Commercial or complimentary eligibility never changes factual scores, evidence
requirements, native acceptance authority or material correction status. Every
permitted answer retains baseline provenance and material uncertainty/correction
disclosure; enhanced analysis may have a separate audience without revealing
private inputs. Product tiers, prices, service levels and broader beneficiary
types remain separate activation decisions. [FACT32-FACT35](../testing/information-verification.md#query-quality-and-commercial-cases)
compose these invariants with the purchase and grant lifecycle below.

## Logical model

These owners use concrete native keys and validated references, not a new global
Unit parent, an unchecked resource-type/ID pair or a universal account level.
Physical families are cataloged in [D22](database/data-dictionary.md#d22-subscribe-and-participation-policy-contracts).

| Concept | Identity and required meaning |
| --- | --- |
| Offering | Stable identity; eligible target REF, operating Entity and lifecycle. The target owns a registered Subscribe capability; eligibility is checked at creation and use. |
| Plan group | Offering-local group declaring either replaceable alternatives or independently purchasable plans. This describes purchase compatibility, not entitlement precedence. |
| Plan and revision | Stable plan identity plus immutable terms/benefit selections and lifecycle. Several plans can be offered from the beginning; they need not form a linear hierarchy. |
| Price | Exact plan revision, currency, integer minor-unit amount, billing interval and applicable price terms. Monthly/yearly prices can sell the same plan. A currency is never omitted or inferred from a browser locale. |
| Benefit definition/revision | Typed resource scope and behavior: access eligibility, a named participation allowance, or a bounded service allocation. Permission, quota and consumable-credit semantics remain distinct. |
| Subscription | Beneficiary, payer, exact purchased terms/price and provider agreement mapping; current lifecycle, paid-through boundary and renewal intent are separate values. |
| Entitlement grant | Exact beneficiary/benefit revision, scope, source, validity interval, revision and revocation. Sources include a subscription, contributor program and direct complimentary award. |
| Purchase intent/receipt | Idempotent agreement to a specific purchase or plan change, expected commercial revision and verified provider result. A browser success redirect is not fulfillment. |

First activation uses authenticated human accounts as private personal beneficiaries.
Public Entity attribution and offering operation still require native participation
and representation. The model retains payer/beneficiary separation; buying for
other people, corporate seats, workload benefits and transferable gifts require
separately activated consent, assignment and accounting contracts. Controlling an
Entity never shares one controller's personal subscription with all controllers.

An offering may contain several scoped benefits. A cross-owner benefit requires
the resource authority's explicit, versioned approval ceiling. The seller cannot
grant another owner's permissions by editing a product description or price.
Initial benefit sets are bounded and nonrecursive. Cross-provider settlement,
arbitrary nested bundles and an organizational "alliance" hierarchy are not prerequisites.

## Purchase and complimentary access independence

This is a required invariant in the API, storage, billing integration and GUI:

**Complimentary and contributor grants do not modify purchase eligibility or a
paid agreement. Paid-agreement changes do not rewrite independent grants.**

| Situation | Required result |
| --- | --- |
| A user has gifted higher benefits and buys a lower plan | Permit the purchase when normal commercial rules allow it. Gifted access is not an existing paid plan or an upgrade base. |
| Gifted benefits already cover the selected plan | Keep purchase available, explain the overlap and create the chosen paid agreement without consuming the gift. |
| A gift arrives during a paid subscription | Leave price, billing anchor, paid-through date, renewal intent and provider subscription untouched. No automatic refund, cancellation, pause, extension or delayed charge. |
| A gift expires or is revoked | Recompute effective benefits from remaining sources. Do not cancel or downgrade a paid plan. |
| A paid subscription ends or is refunded | Update only benefits attributable to that agreement/settlement. Retain other paid, gifted or contributor sources. |
| A user changes paid plans | Determine compatibility, proration and transition timing from actual purchased agreements and accepted quotes, never the highest effective gifted benefit. |
| A gift expires without a paid agreement | Do not start charging or convert the grant into a paid subscription. |

Direct awards do not create fake zero-value payments or provider trial agreements.
Discounts, coupons, credits, deferred billing and gifts purchased for another user
are different commercial operations; implementing one later must not silently
reinterpret existing complimentary awards.

Plan groups constrain only purchased agreements. A replaceable group permits at
most one live purchased selection per beneficiary/offering/group, with a pending
replacement linked to the original selection. Parallel groups allow concurrent
plans; the same exact plan is non-stackable by default unless a later elected
quantity contract says otherwise. There is no beneficiary-wide single-subscription
constraint. The purchase-intent/group fence prevents duplicate checkouts and two
concurrent replacements; fulfillment is idempotent under provider retries.

Purchase admission and quotes do not depend on loading complimentary history or
computing effective gifted benefits. Optional overlap information can be unavailable
without blocking a valid quote/purchase. Paid-source and award-source admission
budgets are separate, so many awards cannot consume the slots reserved for paid
fulfillment. Awards cannot change purchase concurrency keys, invalidate a commercial
quote or enqueue a paid-agreement mutation as a side effect.

## Effective benefits and authorization

For one benefit and compatible scope, any currently valid grant can supply the
benefit. Evaluate validity against authoritative time and current source state.
An unavailable source is not a reason to allow access; another independently
verified source can still supply the same benefit. Return unavailable rather than
"no benefits" if the result cannot be established.

Boolean access is any-of over applicable sources. A quota definition declares its
unit, meter, scope and merge policy. First activation uses the maximum applicable
allowance for identical meter semantics, not a sum of duplicated allowances.
Independent consumable-credit awards may add balances only through unique ledger
entries; incompatible scopes/windows/units never merge. A grant's existence does
not reset a meter or erase a previously consumed amount.

Use one bounded native entitlement resolver and a registered IAM policy adapter.
Do not create a second permission vocabulary or authorize by plan name, UI badge,
provider metadata, cached feature flags or a generic `isPro` field.

- The resource owner binds a declared benefit audience/condition to a bounded,
  approved participation role or resource selection through the existing access
  model. Defining or expanding that mapping requires current grantability and
  the normal assignment ceilings; a plan editor cannot expand it alone.
- Personal entitlements qualify the authenticated principal as an actor-side
  product condition. The selected authority must independently have the native
  resource permission. Public actions also require valid Entity attribution and
  representation; a personal benefit cannot fill a missing Org authority path.
- First Pro enrollment explicitly admits the chosen public participation identity
  and the appropriate ordinary role after consent. Every protected use rechecks
  the operator's personal benefit. Enrollment never substitutes for ongoing
  entitlement, and a stale membership/group projection cannot prolong access.
- The direct-principal content-consumption path can use an explicitly registered
  entitlement-backed recipient audience. It must retain exact beneficiary,
  resource, approved mapping and source provenance in the native proof. This is
  a new IAM adapter to qualify, not an assertion that current Group rosters already
  implement subscriptions.
- Membership, bans/mutes, owner state, credential ceilings, disclosure and selected
  representation continue to apply. Paying, rejoining or switching personas
  cannot clear restrictions or revive prior privileged assignments.

Beneficiary-and-benefit heads serialize source transitions. A proof carries the
relevant grant/mapping/source revisions and next expiry boundary. Protected writes
recheck the dependency closure after lock waits; reads, media delivery, exports
and subscription-sensitive jobs recheck current disclosure. A signed cursor or
past successful entitlement response is not continuing authority.

Source ledgers are canonical. A beneficiary/benefit current projection is an
indexed read aid with a completeness/freshness contract; it never preallocates a
beneficiary-by-content or beneficiary-by-Realm grant matrix. Preserve a verified
surviving source when another ends. If a necessary refresh exceeds its budget,
expose pending/unavailable and enqueue bounded repair rather than returning stale
access or silently revoking known independent sources.

## Commercial lifecycle and recovery

Offering/plan lifecycle is draft, offered, retired or suspended. Retirement stops
new purchases; it does not rewrite existing agreements. Published plan revisions
are immutable. First activation pins purchased terms; a new price or expanded
benefit revision applies to a new purchase or explicitly accepted plan change.
Compulsory service termination requires an explicit policy and settlement flow,
separate from editing the offering. Authority withdrawal can immediately stop
unsafe resource access, but must also expose the resulting fulfillment problem.

Separate subscription service state from collection state:

| State or transition | Service effect |
| --- | --- |
| Pending purchase / additional payment action required | No paid grant yet; independent grants still work. |
| Verified settlement / activation | Atomically record the receipt and its exact service interval/grants. |
| Renewal pending or payment failure | Do not invent an extension. Retain the existing paid interval; any grace period must be an explicit, finite policy recorded separately. |
| Cancel renewal | Keep the agreed paid interval; stop future automatic renewal only after provider confirmation. |
| Upgrade/downgrade | Use an expiring quote fixing old/new terms, effective time and provider-supported adjustment. Keep the old agreement effective until the accepted transition activates. |
| Paid interval ends | Expire its service grant by time even if maintenance has not run. Preserve enrollment/content/history and other sources. |
| Refund/dispute | Apply a source-specific settlement policy and auditable state transition; a financial event is not a platform ban. |
| Provider result uncertain | Preserve a pending operation and reconcile it. Do not report confirmed purchase, cancellation or refund. |

Provider identifiers are unique within provider account/environment. Verify event
authenticity, deduplicate events and effects, and reconcile current provider state
when event ordering is insufficient. An incoming paid-entitlement summary covers
only that provider's source domain; it is never a replacement for all local grants.
External calls do not run under database locks. Use durable intents/outbox, bounded
leases, retries and receipts for the provider/database boundary. Duplicate events
must not award another service interval, refund twice or restore revoked grants.

Provision local benefits only from verified commercial facts. Persist local
resolution state so ordinary content requests do not call a payment provider.
Reconciliation repairs missed events and detects paid-but-unfulfilled agreements;
it is independent from delayed expiry cleanup. Resolve erase/cancel races through
the native account fence and ensure a webhook cannot recreate erased identities.

Ownership transfer of an offering or covered resource is explicit. Do not retarget
its seller, beneficiary or existing billing account by changing a public Entity
label or resource owner. Suspend new sales when the required authority disappears;
record continuity/termination decisions and outstanding obligations for existing
agreements. General marketplace payouts are deferred, not implied by Subscribe.

## API capability contract

These are domain operations to implement through owning APIs, SDKs and permitted
MCP adapters. Paths and transport schemas are generated during implementation;
the following names are not a claim that endpoints exist.

| Capability | Inputs and observable outcome |
| --- | --- |
| List offerings/plans | Authorized target REF, locale and bounded keyset page; return exact offered revisions/prices, purchase compatibility and viewer-safe availability. |
| Manage offering/plan | Current operator authority, expected revision, bounded benefit set and approvals; draft, publish, revise, retire and suspend are explicit transitions. |
| Quote purchase/change | Beneficiary from verified context, actual paid selection, chosen price/terms and operation ID; return total/currency, effective time, recurrence and expiring quote. Gifts cannot change this quote's commercial baseline. |
| Confirm purchase/change | Exact quote and consent; return action-required, pending, active, conflict or unavailable plus a stable operation handle. Retry resumes the same operation. |
| Manage renewal/settlement | Exact agreement and revision; request cancel/resume or source-specific refund, then expose confirmed/pending/failed provider outcome. |
| Award/revoke benefits | Authorized grant issuer, private beneficiary selector, exact benefit revision/scope, reason/program reference and validity; independent idempotent grant receipt. |
| Read own subscriptions | Paid agreements, renewal intent, next known charge and pending changes. Complimentary grants do not appear as purchased plans. |
| Read effective benefits | Requested resource/benefit scope; separate source intervals, coverage, limitations and denied/unavailable result. Source details are redacted outside the beneficiary/authorized management context. |
| Resolve operation/history | Current authority and scoped opaque handle; original result/receipt plus current status, bounded immutable history and provider reconciliation state. |

Every mutation has a stable operation ID and expected relevant revisions; digest
the exact beneficiary, terms and target scope. A retry after revocation must not
disclose an otherwise private old result. Batch operations declare atomicity and
count raw candidates before filtering. Server time defines validity; intervals
are half-open, and a null expiry explicitly means non-expiring only for eligible
grant kinds. Omitted patch fields preserve values; empty benefit sets, unsupported
targets, invalid references and ambiguous scopes are rejected rather than widened.

## User experience and disclosure

Use the existing feature organization, UI library and typed locale owners. Ordinary
users compare benefits and prices, purchase, inspect sources and manage renewal
without editing policy IDs. Advanced operators can configure supported plan groups,
resource benefits and policy revisions without losing API-created configuration.

Display three independent views: purchased plans; gifted/contributor awards; and
effective benefits. A high gifted benefit does not hide lower plans, turn a purchase
button into an upgrade, show a paid badge, or change a checkout price. Disclose
overlap and actual renewal terms before purchase while leaving the valid purchase
available. Do not automatically suggest that a grant extends paid time.

Offer owners see only the subscriber/fulfillment information authorized for their
offering. Contributor assessment notes, private payment identity, other subscriptions,
and mappings between public personas remain private. A public supporter badge or
subscriber roster requires its own consent/disclosure policy. Payment card data
and provider secrets do not enter public Entities or ordinary content histories.

Account erasure immediately disables private eligibility, then runs bounded
subscription/provider cancellation and source-grant cleanup. Separate required
financial-record retention from removable contact, profile and assessment data.
Retained receipts contain minimal identifiers, not immutable private prose. Restore
must replay revocation/erasure frontiers before content or renewal workers resume;
expired awards and old provider events cannot resurrect access or billing.

## Evidence and remaining qualification

Primary sources consulted September 15, 2026:

| Source | Selected lesson | Applicability limit |
| --- | --- | --- |
| [YouTube membership levels](https://support.google.com/youtube/answer/7544492?hl=en) | One creator can offer multiple levels/perks. | Does not require every REZICS plan to be a mutually exclusive linear tier. |
| [X Subscriptions](https://help.x.com/en/using-x/subscriptions) | Creator subscriptions can expose selected content and subscriber interactions. | X's per-creator purchase model is not a generic REZICS bundle or authorization contract. |
| [Stripe Entitlements](https://docs.stripe.com/billing/entitlements?dashboard-or-api=api) | Separate product pricing from benefits, map a feature to several products, and persist local access state. | Provider-derived entitlements do not include all contributor/direct grants or enforce resource ownership. |
| [RevenueCat granted entitlements](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile) | Direct awards are independent of store billing and do not cancel, charge, refund or convert subscriptions. | Purchase-page noninterference and REZICS quota merging still need explicit implementation and tests. |
| [GitHub sponsorship tiers](https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/managing-your-sponsorship-tiers) | A person's offering may grant access to another authorized resource; independent manual access survives synchronization. | Its repository and account restrictions are product-specific. |
| [Stripe webhooks](https://docs.stripe.com/webhooks) | Events can be duplicated/out of order; delivery and fulfillment need recovery. | This source does not select a REZICS payment provider or qualify a local adapter. |

Selected REZICS combinations are design decisions, not demonstrated performance
or usability results. [M10](../plan/modules/subscriptions-and-pro.md) lists pending
implementation and [SUB01-SUB24](../testing/subscriptions-and-pro.md#subscribe-contract-cases)
defines acceptance. Pricing, supported payment provider/markets, finite grace,
refund/termination terms and award durations must be configured before the affected
commercial behavior opens. Missing configuration is unavailable, never unlimited
access or implicit charging. Native multi-plan behavior and gift independence are
required regardless of those operating values.
