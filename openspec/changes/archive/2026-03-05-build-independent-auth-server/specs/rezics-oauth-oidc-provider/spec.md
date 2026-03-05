## ADDED Requirements

### Requirement: Rezics authorization server capability
The auth service SHALL enable `@better-auth/oauth-provider` and SHALL expose Rezics as an OAuth 2.1 Authorization Server with OIDC-compatible behavior.

#### Scenario: OAuth/OIDC discovery metadata is requested
- **WHEN** a client requests discovery metadata
- **THEN** the service SHALL provide `/.well-known/openid-configuration` and SHALL provide `/.well-known/oauth-authorization-server` when plugin support is enabled

### Requirement: OIDC minimum compatibility
The authorization server SHALL support at minimum `openid` scope, `userinfo`, and `id_token` issuance behavior.

#### Scenario: OIDC client requests openid scope
- **WHEN** a valid OIDC authorization flow completes with `openid` scope
- **THEN** the server SHALL issue OIDC-compatible identity artifacts and SHALL expose user information through the configured userinfo behavior

### Requirement: Issuer validation and logout compatibility
Authorization responses SHALL include issuer information (`iss`) to support issuer validation and SHALL support RP-initiated logout compatibility when OIDC logout is enabled.

#### Scenario: Authorization response is validated by relying party
- **WHEN** a relying party validates the authorization response
- **THEN** the response SHALL contain issuer information sufficient to prevent mix-up attacks

### Requirement: External social providers and account linking
The auth service SHALL support Google, Microsoft, GitHub, and Twitter login providers and SHALL link accounts by verified email merge policy.

#### Scenario: User signs in with a second social provider using same verified email
- **WHEN** provider account email matches an existing verified user email
- **THEN** the service SHALL merge/link the identity to the existing user account rather than creating a duplicate user
