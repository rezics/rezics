# Subscribe and Realm participation acceptance

Status: required contract scenarios; none executed or qualified by this document.
Owners: [Subscribe](../architecture/subscriptions.md),
[Realm policies/Pro](../architecture/realm-participation-policies.md),
[capacity](../architecture/subscriptions-capacity.md) and
[M10](../plan/modules/subscriptions-and-pro.md).
The [execution workflow](../plan/execution-workflow.md) governs later test authoring
and execution. These specifications do not activate runtime implementation, fixtures,
document checkers, browser QA or a new verification phase.

## Subscribe contract cases

Use actual native IDs produced by earlier authorized requests. Cover direct private
beneficiaries, valid public attribution, an independently controlled Entity and an
unauthorized actor. Commercial fixtures use a reproducible provider adapter with
signed duplicate/out-of-order events; separately qualify the chosen provider's
sandbox and supported operations before accepting live purchase behavior.

| ID | Scenario and required result |
| --- | --- |
| SUB01 | Create offerings for an authorized Realm and Person through the same Subscribe capability. Person offering requires no placeholder Realm. Unsupported targets, catalog-only control claims and forged owner references are rejected. |
| SUB02 | Distinguish seller, target, beneficiary and benefit resource. Configuring another owner's resource requires exact approval; replacing its owner or expanding a mapping invalidates stale authority. |
| SUB03 | Offer several plans, monthly/yearly price choices, replaceable groups and concurrent add-on groups. No global single-subscription constraint; unsupported currency/interval, empty benefits and incompatible purchase combinations are rejected explicitly. |
| SUB04 | Two concurrent checkouts for one replaceable group produce at most one paid selection. Duplicate confirmations resume the same intent and never create a second provider agreement or debit. |
| SUB05 | Gift high-tier benefits, then quote and buy a lower plan. Quote, available plans, price and purchase eligibility are identical to the same actual paid state without the gift. Fill the award-source budget and make overlap/history reads unavailable; paid-source admission and a valid commercial quote still work. |
| SUB06 | Gift all benefits of the chosen plan, then purchase it. Purchase remains available and both grant sources persist; the award is not consumed or converted into a paid plan. |
| SUB07 | Award benefits during a paid interval. Provider calls, price, billing anchor, paid-through boundary, renewal flag and future charge schedule are unchanged. No implicit refund, extension, cancellation or delayed charge. |
| SUB08 | Revoke/expire a gift while paid access remains. Paid agreement and paid-derived benefits remain effective. Gift-only expiry cannot create a charge or a provider subscription. |
| SUB09 | End/refund one paid source while a gift, contributor award or another compatible paid source remains. Recompute only affected benefits; never replace all local grants with one provider summary. |
| SUB10 | Upgrade/downgrade while a higher gift exists. Quote and adjustment use the actual paid agreement; expiry or revocation of the gift between quote and confirmation does not change the commercial baseline. |
| SUB11 | Repeat an award/revocation request. Same operation returns the same receipt; a different operation cannot reuse the effect key with another beneficiary/benefit. Preserve grant origin and exact scope. |
| SUB12 | Combine overlapping boolean benefits, identical meter allowances and separate consumable credits. Boolean any-of, declared maximum allowance and unique additive credit events remain distinct; no automatic sum, quota reset or incompatible-window merge. |
| SUB13 | Browser checkout success arrives before settlement. Return pending/action-required until a verified source activates; cancellation intent alone does not assert provider confirmation. |
| SUB14 | Replay signed provider events in reverse order and with duplicates. No double service interval/refund, backward state overwrite or resurrection after source revocation; forged signatures and wrong provider accounts are rejected. |
| SUB15 | Miss a webhook, then reconcile. Recover paid-but-unfulfilled state with the original operation; preserve provider-independent gifts. A truncated/paginated provider summary cannot erase unseen sources. |
| SUB16 | Cancel renewal, fail a renewal or cross a paid-through/grace boundary. Service intervals and renewal intent remain separate; expiry takes effect without waiting for cleanup, and absent grace policy does not grant time. |
| SUB17 | Revise/retire a plan or price. New sales use offered revisions; existing purchased terms stay pinned until accepted change. Retiring a plan does not cancel existing agreements or destroy receipts. |
| SUB18 | Race beneficiary/source/mapping changes against protected reads/writes and fulfillment. Recheck authoritative time after locks and exact source proofs; stale cached benefits never authorize a new effect. |
| SUB19 | Attempt to use a personal benefit through an unrelated represented Org or another controller's account. Native authority/attribution rules still apply; no pooling of incomplete proofs or private benefit sharing. |
| SUB20 | Buy, regain a gift, switch persona or rejoin after a Realm ban/removal. Subscription cannot clear enforcement or revive old membership-generation roles. |
| SUB21 | Read subscriptions/awards as beneficiary, seller, unrelated Realm manager and anonymous visitor. Each sees only permitted scope; no payer identifiers, other plans, contributor notes or controller graph leak. |
| SUB22 | Supply stale quotes, expired private selectors, modified operation digests, null/empty scopes and oversized benefit sets. Preserve invalid/denied/conflict/unavailable outcomes without widening authority or silently losing members. |
| SUB23 | Transfer/retire an offering operator or covered resource. Sales stop when authority is missing, grants obey current resource permission, and billing accounts/beneficiaries do not retarget silently; outstanding fulfillment is visible. |
| SUB24 | Erase an account during provider processing and restore an older snapshot. Replay privacy/revocation frontiers before workers; no renewed charging, recreated persona or revived gift. Retained financial receipts follow explicit minimal retention. |

## Realm policy and Pro cases

Include a Work/catalog Unit, shared Document revisions, independent social
publications, a general Realm, the configured Pro Realm and another independently
configured Realm. Source/current/adopted revisions must intentionally differ.

| ID | Scenario and required result |
| --- | --- |
| PRO01 | Create Rezics Pro through ordinary Realm policy/Subscribe operations. A different Realm uses the same behavior; renaming/using the slug "pro" grants nothing. General Realms and catalog identity keep their existing meaning. |
| PRO02 | Configure free Realm AI review and paid Realm participation without AI. Neither feature implicitly enables the other, and Realm policy cannot loosen platform safeguards or grantability. |
| PRO03 | Explicitly join/acknowledge current Rules and receive participant access with a valid benefit. Subscription alone does not create public enrollment, follow, friendship or every notice subscription. |
| PRO04 | Race policy publication with intake/approval. Capture exact Rule and policy revisions, reject stale consent and retain historical decision rationale; no retroactive acceptance. |
| PRO05 | Concurrent requests compete for the final daily successful-post allowance. At most the admitted number activate. The reviewed remainder stays ready-to-publish, preserving input and an actionable reset time. |
| PRO06 | Compare successful topics, replies, chat and review tasks. They use their declared meters; a normal review rejection consumes intake resources but not successful-publication allowance. |
| PRO07 | Fail/duplicate/delete/withdraw a post or message. Failed commits do not charge, committed retries do not charge again, and deletion does not refund successful-action usage or reset cooldown. |
| PRO08 | Switch Entity, token, plan or gift while limits are active. The same beneficiary/Realm/action window retains consumption; identical granted allowances do not multiply capacity. |
| PRO09 | Cross a UTC boundary between intake and publication, including a policy change. Charge successful publication in its actual activation window; late platform-failure compensation is usable once in the original allowance kind. |
| PRO10 | Exhaust Realm/provider compute capacity or personal review intake. Return the precise bounded state, admit no unreserved model work and preserve existing drafts. No unlimited queue or subscriber exemption. |
| PRO11 | Submit one content candidate to general and Pro contexts. General success can coexist with Pro pending/rejection, and the GUI/API reports each outcome. One submission retry does not duplicate either effect. |
| PRO12 | Attempt to attach/pin/republish a Unit directly into a review-required Realm. All producer paths enforce destination admission and review; default visible association state cannot bypass the policy. |
| PRO13 | Accept v1 in Pro, publish v2 elsewhere, then edit again during review. Pro body, summary, search matches, media and exports stay at the accepted version; the stale v2 review cannot activate v3. |
| PRO14 | Erase/revoke an asset or content revision referenced by an accepted Pro selection. Stop current disclosure even while retaining historical adoption/decision records. |
| PRO15 | Model input requests another Realm's Rules, tools, private messages or permission changes; output is malformed/oversized. Treat it as untrusted evidence, constrain workload authority and route failure without side effects. |
| PRO16 | Model/provider fails, exceeds input/call budgets or produces uncertain findings. Preserve incomplete/needs-human/execution-failed states; no automatic approval, silence or global ban. |
| PRO17 | Human/qualified automated acceptance or rejection records exact Rules; appeal adds an authorized decision/reversal. Findings, policy decisions and execution errors remain separate. |
| PRO18 | Cancel, supersede or lose authority while an AI worker runs, then reclaim its lease. Stale results cannot publish, charge another success or reactivate withdrawn content. |
| PRO19 | General article has Pro acceptance and general replies. Pro detail, reply tree, counts and notices do not include those replies automatically; new Pro replies use their own context and policy. |
| PRO20 | Pro rejects/removes one publication; other authorized uses remain. Accepting the same Unit in two Realms can satisfy both association predicates; a distinct social repost cannot inherit its source's Realm predicates merely from shared text/derivation. Keep independent Publication/Thread semantics without copying body lineage or duplicating votes. |
| PRO21 | Within Realm A enable Pro mode. Require A AND Pro on the same valid association conditions, not A OR Pro; visible-in-A plus withdrawn-in-Pro is excluded. Include pending, hidden and removed states. |
| PRO22 | Author gains/loses Pro benefits or changes a public profile. General publications do not enter Pro automatically and accepted historical Pro publications do not reclassify solely from author subscription changes. |
| PRO23 | Navigate home/search/tags/related content/Work discussion, change tabs and paginate. Enforce the captured scope/selected revision throughout; reject incompatible cursors, preserve draft destination and do not fill empty Pro pages with general content. |
| PRO24 | Send general mentions/invitations, existing DMs, Pro realtime messages and mandatory account notices while preferences/rights change. Apply scope preferences and explicit DM exceptions, preserve account notices, stop protected delivery after revocation, and require deliberate navigation to general contexts. |

## Capacity and recovery cases

| ID | Evidence required |
| --- | --- |
| CAPSUB01 | At 0.1%, 1% and 50% Pro selectivity, compare shallow/deep Feed plans and raw candidates, buffers, page fill and latency. Increase unrelated corpus while holding Pro results fixed; confirm scope-leading retrieval. |
| CAPSUB02 | Measure popular/rare multilingual full text with different accepted/current revisions, Realm intersections and hidden candidates. Verify exact-version text/facets, bounded sparse/dense plans and truthful lower-bound/partial results. |
| CAPSUB03 | Load overlapping grants, long histories, expiry bursts and near-budget source sets. Measure bounded entitlement reads and source transitions; overflow is explicit, while independent verified sources survive source-specific revocation. |
| CAPSUB04 | Measure hot-Realm publication and last-slot meter concurrency. No Realm-global serialized meter for all users; consumed quota and compensations remain exact across rollback/retry. |
| CAPSUB05 | Measure review intake, tokens/cost, backpressure, queue age and lease recovery under provider degradation. Concurrency math, completion latency and spend stay distinct from fast enqueue time. |
| CAPSUB06 | Measure each new physical family/index, relation/version/attempt amplification, WAL and replica/rebuild headroom at the 500M/3B planning scales. A small fixture qualifies plan shape only; retain the explicit scale estimate. |
| CAPSUB07 | Interrupt policy/selection backfills, ranking refresh and erasure at every frontier. Resume without rescanning all subscribers/content, losing committed updates or publishing an incomplete generation. |
| CAPSUB08 | Restore an old database with pending payment/review jobs. Reconcile provider receipts and replay erasure/revocation before exposure; no duplicate charge, restored private text, gifted access resurrection or stale worker publication. |

## Experience cases

| ID | User outcome |
| --- | --- |
| SUBUX01 | Compare multiple plans, including a lower plan when a higher gift exists. Purchase remains available and overlap is explained without implying a discount or paid-time extension. |
| SUBUX02 | Inspect purchased plans, extra awards and effective benefits separately; change/cancel a real subscription and see its actual pending/confirmed billing outcome. |
| SUBUX03 | An operator configures a Person or Realm offering, plan compatibility and authorized benefit resources; ordinary edits preserve advanced API-created state. |
| SUBUX04 | A participant submits from Pro, sees exact review/quota states, revises or appeals, and retains the original destination and input after failure. |
| SUBUX05 | Stay in Pro through discovery/details and receive no unrequested general activity. Explicitly leave scope through a link without silently changing another tab or draft. |
| SUBUX06 | Complete a Work-to-discussion-to-repeated-contact/group journey using real participants and authorized content. Track response time, repeat exchanges, useful contribution, appeals and operator load separately from message volume or paid conversion. |

## Evidence collection and gates

During the elected verification phase use owning Taskfiles for TypeScript,
deterministic contracts, real PostgreSQL persistence/concurrency and stateful APIs.
Do not invent future task names or count document existence as executable coverage.
New native schemas require the normal forward generator, disposable replay and
fresh-install/recovery qualification. Provider adapter conformance is additional
to a simulated provider fixture.

When UI implementation is activated, affected workspace checks and scoped Storybook
tests/screenshot review apply. Full-application browser/human-study work follows
the explicit authorization boundary in [AGENTS.md](../../AGENTS.md); this document
does not authorize it by itself. AI quality qualification uses representative
language/topic samples, legitimate borderline contributions, adversarial inputs,
false acceptance/rejection, human overrides and costs. A vendor classifier result
or two agreeing models is not independent proof of quality.

Evidence records exact commit, selected contracts, runtime/model/provider versions,
input distributions, reproducible commands, observed limits and unresolved failures.
SUB/PRO specifications remain pending until executed; SUBUX outcomes are not proved
by schema tests, and CAPSUB plans are not achieved throughput or launch readiness.
