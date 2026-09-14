# Identity and access experience

Status: selected GUI/API design contract; rendered and human-use acceptance is pending.
The [identity contract](identity-and-access.md) and [connected-app contract](connected-apps.md)
own authorization. This owner applies the [product design principles](product-design-principles.md)
to how people use those capabilities.

## Ordinary experience and progressive disclosure

For ordinary identity tasks, users should not need to understand AuthPrincipal,
RoleBinding, delegation chains or token claims. Apply the common ordinary-user
priority and capability-fidelity contract to the following task audiences.

Organize three task audiences, not three mandatory nested screens:

| Audience | Initial experience | Available when needed |
| --- | --- | --- |
| Everyday use | Sign in to the valid default Entity, see current name/avatar, read/post/join, accept a clear invitation, connect or disconnect an App. | Identity switcher, personal defaults, connected-app access details. |
| Collaboration management | Named members/teams, invite/remove, choose understandable role presets, manage one Org/Realm or shared Entity. | Custom groups, multiple roles, scoped resource selection and effective-access explanation. |
| Advanced administration/development | A dedicated management workspace for people who need it, with task-specific entry points. | Mixed recipients, custom role definitions, bounded hierarchies, representation/redelegation, client credentials, installation policy and restricted audit evidence. |

Common screens expose relevant choices and a clearly named path to advanced
controls. Advanced workspaces are directly reachable by authorized managers;
avoid stacks of nested dialogs. Do not present all API fields or all administrative
concepts on the ordinary account/profile screen. Presets configure the same
backend contracts as advanced controls; no second simplified permissions system.

The [common evidence and limits](product-design-principles.md#evidence-and-limits)
support progressive disclosure and recognizable choices. Validate this feature's
split and navigation with representative users; the sources do not establish its usability.

## Defaults, attribution and recovery

Onboarding admits a usable Entity and establishes the private main preference.
With one usable choice, or a valid saved default, enter normally without an identity
wizard. Display the current Entity at identity-sensitive actions. More identities
appear in a switcher; keep the user's actual control/representation scope clear.

Account defaults, per-app defaults, open drafts and active authorizations retain
their separate meaning. Switching in another tab cannot change a prepared post's
author. If authority disappears, preserve input and explain that the selected
identity is unavailable; ask for an explicit usable choice before effect. A
switch never merges private preferences, reads or security settings.

YouTube's [default channel](https://support.google.com/youtube/answer/6019090) and
[multiple channel managers](https://support.google.com/youtube/answer/4642409?hl=en)
support the default-and-switch interaction and many-to-many control analogy.
Their product/API restrictions are not copied into REZICS.

## Capability fidelity

| User task | GUI contract | API/authority preserved |
| --- | --- | --- |
| Join or accept invitation | Clear destination, participation identity and terms; ordinary successful entry needs no role editor. | Exact target, recipient, admission generation, rule revision and accepted/pending outcome. |
| Share management | Select named recipient(s), role and target; offer a useful preset. | AuthPrincipal, Entity and eligible member-set recipients are expressible through authorized selectors; private raw IDs stay hidden. |
| Create an access group/team | Name a team, add members and select duties in one coherent flow. | Separate Group, Role and Binding ownership; multiple memberships/roles remain editable. |
| Adjust advanced access | Scope picker, custom role editor and visible impact preview. | No lost restrictions, expiry, role revision, delegated ceilings or cross-scope semantics. |
| Understand access | Explain which role/group or representation permits an action, or which condition blocks it. | Backend-derived provenance, redacted for the viewer; no browser-side authority inference. |
| Connect an App/AI client | Show the selected Entity, requested activities, resources, offline use and relevant trust information; allow approval or cancellation. | Personal consent and scope installation are distinct; no approval hidden under an advanced disclosure. |
| Remove an App or member | State the affected scope and practical effect; preserve unrelated access. | Consent, credential, installation and membership revocation are separate commands. |
| Administer credentials | Dedicated authorized workspace, one-time secret display and clear rotation/revocation outcome. | Current administrative authority and required fresh-authentication conditions. |

Routine controls must preserve advanced state created through APIs. If an editor
cannot safely modify a configuration, show its relevant summary and route to the
capable editor; never silently flatten it to a preset or discard hidden fields.
Cross-page selections, empty filtered pages with continuation, unavailable public
labels and stale revisions retain their API semantics.

Use public Entity labels where permitted and purpose-specific private recipient
handles where needed. Do not make public Entity selection an account-enumeration
endpoint. Public membership is not a controller roster. Explain consequences in
ordinary language; keep protocol identifiers and authorization proof internals in
restricted diagnostics rather than required user inputs.

Use the existing feature owners, @rezics/ui and typed locale resources. Layout
choice follows task and information relationships; the schema does not prescribe
one card or one screen per table. Capability visibility is convenience; backend
authorization remains mandatory regardless of UI level.

## Acceptance

The [experience cases](../testing/identity-and-access.md#experience-acceptance)
cover ordinary entry, switching, collaboration, advanced round trips and consent.
Before G5 completion, observe representative users performing common and advanced
tasks, recording completion, navigation, errors and attribution mistakes. Revise
the grouping when ordinary tasks repeatedly require advanced concepts.

Storybook/component checks and actual screenshot inspection qualify implemented
components under the [existing workflow](storybook-workflow.md). Full-application
rendered QA and human studies require their separately authorized execution scope.
This documentation task starts no application or browser QA and claims no rendered
or human-usability result.
