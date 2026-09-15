# Realm participation policies and Rezics Pro

Status: selected target contract, September 15, 2026. This is the first product
application of [Subscribe](subscriptions.md), scheduled through
[M10](../plan/modules/subscriptions-and-pro.md). It does not change the active IAM
implementation phase or claim that current publication/search code passes this target.

Realm remains the community, membership, rules and publication-context owner.
[Collection/Zone composition](realm-collection-zone.md),
[content adoption](database/content-composition.md) and
[governance decisions](governance-rule-decisions.md) retain their responsibilities.
[Scoped delivery](realm-scoped-delivery.md) owns independent site profiles,
multi-Realm reply connections, current disclosure and the common API context.
Quotas and AI review are reusable Realm policies, not special privileges attached
to a global Pro account type or properties of a purchased plan.

## Scope and first product

Rezics Pro is an ordinary official Realm selected by product configuration. Its
name/slug is not an authorization key, a new Realm subtype, or an ancestor of all
paid communities. Its first configuration uses subscription/contributor/gift
benefits for participation, finite action/resource budgets and version-bound review.
It uses ordinary membership, rule acknowledgement, roles, publication and moderation.

Other Realms can use the same policies with free admission, their own Subscribe
offering or different supported limits/review settings. A paid Realm need not use
AI review; a free Realm can use it. A Person can offer subscriptions without a
technical placeholder Realm. Multi-resource benefit bundles can be introduced
through Subscribe; no "alliance" entity or all-Realm enrollment is needed here.

Keep the existing community and catalog experiences. Pro mode adds a selected
publication scope to them; other Realms do not become a single General Realm or
acquire Pro's rules. First operations concentrate on deep-interest participants,
reliable contributors and sustained discussions. Public Work identity, catalog
facts, provenance and existing authorized public uses remain shared.

The initial product journey retains discovery of Works, meaningful posts/replies,
basic chat and consent-based private relationships, cross-Work groups and evidence
submission with a durable result. Source coverage is not narrowed to the pilot's
seed Works. Subscription checkout is not a substitute for this community journey.
The initial operating proposal is a small invited cohort with designated topic
hosts; cohort sizes, prices, grant durations and numeric quality targets remain
operating configuration rather than schema invariants.

## Versioned participation policy

Each Realm selects one immutable policy revision with an expected-head update and
explicit effective time. A revision contains only supported, typed settings:

| Policy dimension | Required meaning |
| --- | --- |
| Admission | Eligible subject/benefit audiences, current rule consent and open/application/invitation behavior, integrated with native enrollment. |
| Resource access | Explicit ordinary participant rights and any subscriber-only audience. Membership or a display context alone grants nothing. |
| Publication budgets | Separate successful-topic limits, reply limits and action-specific cooldowns. Meters declare beneficiary, Realm, action, time basis and applicable allowance. |
| Review intake | Maximum admitted review tasks and bounded resubmissions, distinct from successful publication counts. |
| Review execution | Covered content/actions, exact Rule references, input/output budget, registered model adapter, finite retries, timeout and human fallback. |
| Publication/update behavior | Accepted version selection, review on changed content, release/adoption activation, and local removal/reversal behavior. |
| Notice preferences | Realm-scoped activity delivery and default scope behavior; personal DM and mandatory account notices remain separate. |

Policies are declarative configuration for registered domain commands, not uploaded
scripts, arbitrary SQL or a general agent-hosting facility. Operators need native
policy-management authority. Benefit mappings require subscription grantability;
quota changes cannot grant resource access or relax platform safety/account limits.
An omitted patch value preserves the current setting. Missing mandatory configuration
makes the operation unavailable; an explicit disabled review setting differs from a
missing reviewer. Unlimited user interaction, when elected, still has finite platform
and compute safeguards.

New policy revisions do not rewrite old moderation rationale or imply retroactive
rule acceptance. Pending commands carry the intake policy and exact content version;
activation checks current required Rules, policy compatibility and resource authority.
A material policy change requires a new review under the new policy, with a new
attempt attached to the original submission rather than a hidden duplicate request.

## Metering and accounting

Use the private beneficiary/accountability identity for personal meters. Public
Entity switching, extra API tokens and multiple entitlement sources do not multiply
the allowance. Use a canonical meter identity independent of a policy revision:
changing a limit cannot reset consumed usage. Platform API admission, personal
Realm participation, and Realm/operator compute budgets are separate constraints.
The existing account/API quota service is not itself the new product meter ledger.

First daily windows use UTC with half-open boundaries and server time; show the
actual reset timestamp in the viewer's locale. A cooldown is elapsed time since a
successful action, not a calendar-day counter. Realm/topic/channel scope must be
explicit; Pro activity does not consume another Realm's local social allowance.
Platform anti-abuse limits can legitimately span them. Personal DMs use their own
anti-harassment policy and are not silently put under group-chat cooldowns.

- Review intake consumes one task allowance on formal acceptance. Normal completed
  rejection still used review resources. Validation failure and a replay do not
  consume another task. Platform execution failure produces one compensating
  credit in the original allowance kind; expired daily windows return a separately
  usable same-kind credit rather than crediting an unusable old counter.
- Successful-publication limits are checked and charged atomically at activation,
  in the activation window. A reviewed item whose publication allowance is exhausted
  stays ready-to-publish with a reason and reset time. A later explicit publish
  request rechecks authority, accepted version and current window; no midnight
  auto-publication or silent charge occurs.
- Normal replies/group messages charge on successful commit. Failed sends do not
  advance cooldowns; retries of committed sends return the original result; deletion
  or withdrawal does not restore a successful-post allowance.
- Compute admission reserves bounded Realm/provider capacity separately. The job
  records actual usage and releases unused reservations on terminal failure or
  cancellation. It cannot run until both personal intake and operator compute
  policy allow it; a gifted participant does not receive unbounded AI resources.

Consumption and compensation have unique effect keys. A failure and a correction
cannot each return the same debit. Concurrent requests for the last allowance
serialize on the meter key; they do not lock a single Realm-wide counter for all
members. Identical allowance definitions merge by the Subscribe policy, while
independent credit awards retain unique ledger identities and consumption order.
The client receives remaining allowance, reset/next-send time and the limiting
dimension without exposing another user's usage.

## Publication, adoption and review

"Also publish in Pro" is an explicit destination choice or an independently
authorized adoption. A creator's own subscription never automatically publishes
all their content in Pro. Merely attaching a Realm reference, pinning a Unit or
quoting a private item cannot bypass source rights or destination review.

The existing `realm_unit` relation supplies publication association/state. The
target also requires the exact selected publication/adoption revision under the
native content contract. Reuse content and revisions rather than cloning an entire
catalog or inventing another content owner. For a social cross-Realm repost, create
the independent Publication required by the social-publication contract while
reusing authorized Document revisions. Presentation reuse of an existing publication
does not invent a new utterance or merge its discussion scope.

[Reply identity and acceptance](realm-scoped-delivery.md#reply-identity-and-multiple-realm-acceptance)
defines author-once/multi-destination reply publication, additional acceptance and
independent reposts. One reply can be accepted in A and Pro; neither a shared body
nor a root acceptance automatically imports another Thread's replies. Each
destination independently runs this owner's admission, metering and review.

Review intake records submission identity, target Realm, exact content/dependency
revision, policy/Rule revisions, original authority evidence and idempotency key.
The state machine is pending, reviewing, needs-human, changes-requested,
ready-to-publish, published, rejected, cancelled, superseded or execution-failed.
Retries are attempt records within that submission; editing content supersedes the
candidate and requires a new exact candidate revision. A multi-destination GUI
reports independent accepted/pending/rejected outcomes, not a single false success.

The initial enabled AI path classifies bounded submissions against disclosed Realm
criteria: topicality, spam/duplication, required evidence and applicable content
Rules. It may recommend acceptance or a human review. Activation of automatic
decisions requires a qualified policy/model configuration with acceptable false
positive/negative and appeal outcomes; until then the same workflow routes to a
human. AI service failure never becomes approval or a global content ban.

The reviewer is a native, scoped workload with explicit content-read and review
authority. The model's output is untrusted structured evidence, not an executable
permission or a tool command. User content cannot replace instructions, select
another Realm's Rules, request arbitrary URLs/tools or modify billing/grants.
Inputs include only authorized content/dependencies; missing material yields an
incomplete review rather than a full-content approval. Each run fixes model and
configuration versions and has bounded input/output, external calls and retries.

AI findings and execution attempts remain separate from governance decisions.
An authorized human or delegated policy executor records actual accept/reject/hide
effects through the existing exact-Rule/reversal ledger. Approvals are also
rule-backed under the current governance contract. Decisions retain their actor,
approved automation policy and bounded evidence; no model confidence score replaces
the Rule basis. Human override/appeal is an explicit decision or reversal, not
deletion of the original finding. Private review evidence has retention/erasure rules.

Before publishing, revalidate selected content/dependencies, current rights,
membership/benefits, Rule/policy compatibility, meter availability and worker lease.
Commit the exact adopted/published selection, local visible state, successful-action
charge, governance receipt and outbox atomically. A stale worker cannot activate
after supersession, cancellation, withdrawal, erasure or loss of authority. Provider
calls never hold these database locks.

### Edits and local effects

The selected target keeps the last accepted Pro revision while a new revision is
reviewed; acceptance atomically selects the replacement. A source erasure or current
disclosure withdrawal can make the old version unavailable immediately. Search,
snippets, media, exports and metrics must consume the same selected revision.
Following the editor's latest head would bypass review even if the original Realm
association remains visible. Implement the exact-selection dependency before
qualifying Pro; a current-head-only reader is not an accepted completion shortcut.

Rejecting or removing a Pro publication affects that Realm's selection, not other
authorized publications. Platform-wide action requires separate platform authority.
Existing public copies remain public; publishing them in a paid community cannot
retroactively make those copies secret. Subscriber-only bodies need their own
explicit audience/asset disclosure, not just an unavailable navigation link.

Comments, response targets, notifications and counts retain their own contexts.
Accepting a root article in Pro does not accept every existing/general reply.
Replies authored from Pro use the Pro Thread/publication context and its policy;
cross-posting elsewhere is another explicit action. Thread ancestry never copies
hidden replies or their counts into Pro. Scoped reactions/ranking inputs retain
feature-specific identity and deduplication semantics; reuse must not duplicate votes.

## Pro query and experience contract

The first independently deployed entrance is `https://pro.rezics.com`, using the
[same-origin site adapter](realm-scoped-delivery.md#same-origin-site-adapter) and
shared domain APIs. Its server profile fixes the Pro Realm; a browser preference
cannot disable that scope. A future general-site Pro toggle uses the same resolver.
The [common context contract](realm-scoped-delivery.md#three-independent-contexts)
owns fixed-predicate conjunction, accepted-version selection and cursor/cache
propagation. A Pro author's general post stays outside Pro; an author's subscription
expiry does not itself reclassify accepted publications. Public catalog reference
lookups remain separately declared operations, not a general social-content fallback.

General activity must not fill sparse/empty Pro results. General Realm invitation,
mention and activity notices are not proactively delivered in Pro mode. Keep those
events available through the general inbox under its own authority. Existing DMs
have an explicit opt-in exception setting; account security/billing and essential
system notices remain deliverable. Check scope preference and current entitlement
before notification/media/realtime delivery. Previously delivered bytes cannot be
recalled, but disconnect/revocation must stop further protected delivery.

A deliberate link to a general context shows its destination and requires explicit
navigation out of Pro mode; it does not silently broaden the ongoing Feed or draft.
Gifted and paid participants use the same configured participant rights. Screens
show awaiting-review, awaiting-quota, changes-requested, unavailable and published
states, preserve drafts, and expose a review/appeal result without private materials.

First Pro defaults to qualified-member access to its community content and
participation, with a separately authored public introduction. Underlying already
public Works/publications remain accessible through existing public paths. A broader
public preview can be enabled through ordinary disclosure policy later; private
rosters, replies and internal review data are not preview content.

## Performance and qualification

Use the [scoped delivery plan](realm-scoped-delivery.md#physical-query-plan-and-lifecycle)
and [shared Filter execution](filter-feed-and-zone-experience.md). The current
singular reply-create API, late Realm filtering, root-only read checks and global
reply counts do not qualify this product. [Capacity](subscriptions-capacity.md)
owns candidate/projection budgets and measurements; a result LIMIT is not a bound
on scanned rows, and an index cannot substitute for current reply authorization.

Required acceptance is [PRO01-PRO24](../testing/subscriptions-and-pro.md#realm-policy-and-pro-cases).
The [SITE/RPLY scenarios](../testing/subscriptions-and-pro.md#scoped-site-and-reply-cases)
qualify its fixed-domain and multi-context reply integration.
The source document in the separately supplied rezics-pro-app example informed the
Work-to-discussion-to-relationship journey. This owner records the selected REZICS
contract without depending on that external checkout, copying its UI stack, or
adopting its fixed four-tier/cooldown/organization-capacity formulas as universal rules.

[Discourse AI triage](https://meta.discourse.org/t/discourse-ai-ai-triage/281227),
consulted September 15, 2026, supports scoped classification, bounded model work
and human review routing. Its documented first-topic deployment is narrower than
this full version/adoption workflow. [Discord slowmode](https://support.discord.com/hc/en-us/articles/360016150952-Slowmode-FAQ)
supports local conversation pacing as a configurable mechanism, not evidence that
a particular cooldown improves this community. Evaluate language/topic error rates,
appeals, first meaningful replies, repeated exchanges, useful contributions and
operator workload before increasing admission or enabling more automation.
