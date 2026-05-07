# rezics-oauth-oidc-provider Specification

## Purpose

Defines Rezics as an OAuth 2.1 / OIDC-compatible authorization server. Auth owns the OAuth/OIDC protocol behavior (authorization, token exchange, userinfo, revoke, client registration, social provider callbacks, account linking), and main owns the public boundary, discovery URLs, and product-side OAuth-app ownership. Auth organization is explicitly NOT used as the ownership model for Rezics OAuth applications.

## Requirements

### Requirement: Rezics authorization server capability
The auth service SHALL enable `@better-auth/oauth-provider` and SHALL provide Rezics OAuth 2.1 Authorization Server behavior with OIDC-compatible behavior. Public OAuth/OIDC clients SHALL interact through main public URLs, and discovery metadata SHALL advertise public main endpoints rather than internal auth service URLs.

#### Scenario: OAuth/OIDC discovery metadata is requested
- **WHEN** a client requests discovery metadata from the public Rezics issuer
- **THEN** the metadata SHALL advertise public endpoints such as `https://rezics.com/auth/oauth/authorize`, `https://rezics.com/auth/oauth/token`, `https://rezics.com/auth/oauth/userinfo`, and an auth-scoped JWKS URI
- **AND** it SHALL NOT advertise `auth.rezics.com` or internal `/api/auth/*` service URLs

### Requirement: OIDC minimum compatibility
The authorization server SHALL support at minimum `openid` scope, `userinfo`, and `id_token` issuance behavior.

#### Scenario: OIDC client requests openid scope
- **WHEN** a valid OIDC authorization flow completes with `openid` scope
- **THEN** the server SHALL issue OIDC-compatible identity artifacts and SHALL expose user information through the configured userinfo behavior

### Requirement: Issuer validation and logout compatibility
Authorization responses SHALL include issuer information (`iss`) to support issuer validation and SHALL support RP-initiated logout compatibility when OIDC logout is enabled. The public issuer SHALL be configured from public main metadata, with `https://rezics.com` as the default issuer unless implementation constraints require a documented auth-scoped issuer.

#### Scenario: Authorization response is validated by relying party
- **WHEN** a relying party validates the authorization response
- **THEN** the response SHALL contain issuer information matching public discovery metadata
- **AND** the issuer SHALL NOT be derived from the internal auth service base URL

### Requirement: External social providers and account linking
The auth service SHALL support Google, Microsoft, GitHub, and Twitter login providers and SHALL link accounts by verified email merge policy.

#### Scenario: User signs in with a second social provider using same verified email
- **WHEN** provider account email matches an existing verified user email
- **THEN** the service SHALL merge/link the identity to the existing user account rather than creating a duplicate user

### Requirement: OAuth implementation remains auth-owned behind main

Auth SHALL continue to own OAuth authorization, token exchange, userinfo, revoke, client registration, social provider callback, and account-linking protocol behavior. Main SHALL own the public boundary and orchestration only.

#### Scenario: OAuth token endpoint is called

- **WHEN** an OAuth client calls `POST /auth/oauth/token`
- **THEN** main SHALL route the request to auth-owned OAuth token handling
- **AND** main SHALL NOT reimplement OAuth grant validation

### Requirement: OAuth token endpoint remains public protocol surface

`POST /auth/oauth/token` SHALL remain a public OAuth protocol endpoint and SHALL be treated separately from any auth session JWT acquisition endpoint. Blocking public `GET /auth/token` SHALL NOT block standards-based OAuth token exchange.

#### Scenario: OAuth client exchanges authorization code

- **WHEN** a valid OAuth client posts an authorization code to `/auth/oauth/token`
- **THEN** the system SHALL process the OAuth token exchange according to OAuth/OIDC rules
- **AND** it SHALL NOT require an existing browser `rezics-session-token`

### Requirement: Discovery metadata separates main and auth JWKS

OAuth/OIDC discovery metadata SHALL publish an auth-scoped JWKS URI for auth/OIDC token verification and SHALL NOT point clients at main `/.well-known/jwks.json` unless the token being verified is a main `rezics-session-token`.

#### Scenario: Client resolves JWKS URI

- **WHEN** a client reads `jwks_uri` from OAuth/OIDC discovery metadata
- **THEN** the URI SHALL point to an auth-scoped public route such as `/auth/session/jwks`
- **AND** the keys SHALL correspond to auth/OIDC signing keys

### Requirement: OAuth protocol storage remains auth-owned
Auth SHALL continue to own OAuth/OIDC protocol behavior and storage required for authorization, token exchange, userinfo, revoke, consent, and client credentials.

#### Scenario: OAuth client exchanges authorization code
- **WHEN** a valid OAuth client posts an authorization code to `/auth/oauth/token`
- **THEN** auth SHALL process the token exchange according to OAuth/OIDC rules
- **AND** main SHALL NOT reimplement grant validation

### Requirement: OAuth app product ownership lives in main
Any Rezics product workflow for requesting, reviewing, owning, or managing third-party OAuth applications SHALL live in main. Auth SHALL receive only the minimal protocol client data needed to execute OAuth/OIDC flows.

#### Scenario: Developer applies for OAuth app
- **WHEN** a developer creates or requests an OAuth application in the Rezics UI
- **THEN** main SHALL own the product record, owner relationship, review state, and authorization policy
- **AND** auth SHALL only store or receive protocol client fields required for OAuth operation

#### Scenario: OAuth app ownership changes
- **WHEN** an app owner or team membership changes
- **THEN** main SHALL update product ownership state
- **AND** auth protocol records SHALL be synchronized only as needed for client validity

### Requirement: Auth organization is not used for OAuth app ownership
The system SHALL NOT use better-auth organization membership as the ownership or authorization model for Rezics OAuth applications.

#### Scenario: OAuth app management is authorized
- **WHEN** a user attempts to manage an OAuth application
- **THEN** main SHALL authorize the action using main-owned user and developer ownership state
- **AND** auth organization membership SHALL NOT grant or deny the action
