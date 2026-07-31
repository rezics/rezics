# Security audit

The audit ledger records security-relevant facts that need a durable, global explanation. It is
not a request log, analytics stream, content revision history, or a history of visits to the
management console.

## Scope

Record these events:

- platform capability grants, expiry changes, and revocations;
- ownership, access grants, restrictions, and invitation resolutions;
- API-token creation, account-quota assignment, token safeguards, credential
  changes, and revocation;
- moderation, account enforcement, suppression, and sensitive policy denials;
- Realm settings, membership, rules, pins, and Realm moderation;
- destructive or high-impact Unit lifecycle, address, structure, and Variant changes;
- system bootstrap and comparable recovery operations.

Do not record ordinary reads, successful authorization probes, reactions, ordinary content edits,
or every successful API call. Domain revision tables remain the source of truth for content
history.

Realm administration is in scope. It is written with `authority.kind = "realm"` and the Realm ID,
while the global console still requires `platform.audit.read`. A future Realm-local audit surface
must introduce its own scoped read permission and redaction contract; Realm membership alone does
not expose the global ledger.

## Record contract

Every record separates:

- `category`: administrative activity, policy denial, or system event;
- `outcome`: succeeded, denied, or failed;
- `actor`: Profile or system, plus the credential kind and credential ID when request-bound;
- `authority`: platform, Realm, or Unit boundary that authorized the operation;
- `action`: stable domain operation identifier;
- `target`: affected record, which may differ from the authority boundary;
- `reasonCode`: a machine-readable decision reason when one exists;
- `details`: action-specific structured context, never secrets or full content documents;
- request and trace identifiers for correlation.

Successful mutation records use the same database transaction as the domain mutation. Denials and
failures are written outside a transaction that is expected to roll back. All writes go through
`recordAuditEvent`; the table is append-only.
