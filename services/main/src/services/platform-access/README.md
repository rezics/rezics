# Platform access

Platform access is an explicit set of capabilities granted to a Profile. It is not a role, account
status, employment relationship, or derived “administrator” identity.

`platform.access.read`, `platform.access.manage`, and `platform.audit.read` are independent
boundaries. Access management implies access reads, but audit reads remain separate because the
global security ledger contains sensitive operational context.

Each grant is an immutable lifecycle entry. Revocation marks the active row; granting the same
capability later creates a new row instead of reviving history. The active-row partial unique index
prevents duplicate current grants. A replacement command:

1. takes an advisory lock;
2. verifies the caller's loaded revision;
3. preserves the final non-expiring `platform.access.manage` grant;
4. revokes changed rows and inserts new rows in one transaction;
5. appends the audit event in that transaction.

The `/api/v1/platform-access` endpoints expose policy, Profile discovery, current grants, provenance,
and optimistic replacement. UI access to `/console` is derived from the same capabilities; the
route name does not grant authority.
