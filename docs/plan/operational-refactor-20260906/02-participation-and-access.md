# P02 — Public Entity, private accounts and accountable participation

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and existing owners

Preserve user identity and enable safe participation by readers, creators, organizations and automation. Supports every authored action and U11/U12.
Owners: `schema/profile.ts`, `schema/entity.ts`, `services/auth`, `services/authorization`, `services/platform-access`, `libraries/access`, `api/governance/ownership-claims.ts`, and Web `auth`, `profiles`, `entities`, `ownership-claims`, `console`.

## Selected contracts

- A public Entity identifies a person, organization, character or service actor. A private Auth principal proves who authenticated. Being cataloged or owning editable metadata grants no right to act as that Entity.
- Implement Entity participation directly under the new contract. Former Profile IDs may be retained or remapped by P11's separate offline converter; they do not constrain target schema or API design. Never merge separately identified catalog Entities merely by name.
- Requests carry authenticated principal, acting Entity, delegated capability/scope and authorization version. Audit preserves the actual operator privately and the public author separately.
- Introduce explicit service principals and scoped credentials for ingestion/adoption jobs. AI model execution is provenance; a model name is not a human account or granting authority.
- Delegation distinguishes publication, catalog editing, membership management and security/identity control. Revocation takes effect in requests, caches, queued jobs and upload operations.
- Automated or organizational identities do not multiply an operator's influence as independent natural users. Aggregate policies preserve private controller information without publishing account links.
- Initial creator/organization claiming is invitation or evidence review followed by explicit grants. No discovery-based automatic impersonation.

## Implementation slices

1. Inventory every Profile FK and authorization/cache key, categorizing public authorship, private account state, delegation, safety administration and historical evidence.
2. Add private bindings and service-principal audit contracts. Migrate own-user authority without granting editors control of cataloged people.
3. Update request context, commands, worker credentials, review decisions, uploads, email preferences and SDK. Include non-Web clients.
4. Migrate authorship, collections, scores, tag votes, realms and notifications by semantics. Keep personal progress with its actual account/self identity; team management never exposes it.
5. Implement scoped identity selection, invitation/revocation/recovery and signed-in self settings. Restore/merge must preserve historical author and operator evidence.
6. Remove the replaced Profile table and old writable API when retained consumers use the new Entity/Auth contract. Do not wait for P11 offline data conversion or retain old v1+ public address redirects for compatibility.

## Acceptance

- A catalog editor cannot claim or impersonate a publisher, author or service actor.
- A revoked delegate cannot finish a queued write even if it was approved under an older grant.
- Managing an organization reveals neither members' private reading journals nor personal notifications.
- A worker can adopt only the approved proposal with an eligible scope; it cannot directly invoke unrelated administrative APIs.
- Removing a final controller enters a recoverable suspended/claim flow; account deletion is not blocked indefinitely.
- Old public authorship survives migration and truthful historical unknown operators remain unknown.
- Authorization allow/deny, delegation/caching, history/merge, generated API and backend/Web typechecks pass.

## Scale and recovery

Use target/principal/scope indexes; evaluate the selected identity, not all identities or the entire metadata graph. The separate offline converter owns old-reference mapping and any credential/session import or recreation; it does not gate new participation contracts. Auth bindings and delegation grow with actual participation rather than every imported Entity. P10 accounts for at least 500M/3B potential participation/reference rows and operator audit growth. No plaintext private data belongs in ordinary migration logs.
