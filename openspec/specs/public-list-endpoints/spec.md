# public-list-endpoints Specification

## Purpose

Defines the public-read posture of the DB-backed list endpoints:
`GET /books/`, `GET /posts/`, and `GET /realms/` accept
unauthenticated callers and force `status=PUBLISHED` /
`visibility=PUBLIC` / `isPublic=true` filters for non-admins. Owns
the removal of `q` (full-text search) from the list query schemas
in favor of the `/meili/*` endpoints, and the rule that
`GET /chapters/` and `GET /feedbacks/` remain admin-only.

## Requirements

### Requirement: Public access to book listing
The `GET /books/` endpoint SHALL accept unauthenticated requests. When the caller is not an admin, the system SHALL force `status=PUBLISHED` and `visibility=PUBLIC` filters regardless of query parameters. The `q` (full-text search) parameter SHALL NOT be available on this endpoint.

#### Scenario: Anonymous user lists books
- **WHEN** an unauthenticated caller sends `GET /books/?tagUnitIds=abc&limit=20`
- **THEN** the system returns books matching the tag filter with `status=PUBLISHED` and `visibility=PUBLIC` enforced

#### Scenario: Anonymous user attempts to list draft books
- **WHEN** an unauthenticated caller sends `GET /books/?status=DRAFT`
- **THEN** the system ignores the `status` parameter and returns only `PUBLISHED` books

#### Scenario: Admin user lists books with full filters
- **WHEN** an authenticated admin caller sends `GET /books/?status=DRAFT&visibility=PRIVATE`
- **THEN** the system returns books matching the requested status and visibility without overrides

### Requirement: Public access to post listing
The `GET /posts/` endpoint SHALL accept unauthenticated requests. When the caller is not an admin, the system SHALL only return posts whose parent unit has `status=PUBLISHED`. The `q` parameter SHALL NOT be available on this endpoint.

#### Scenario: Anonymous user lists posts for a target
- **WHEN** an unauthenticated caller sends `GET /posts/?targetUnitId=xyz&kind=REVIEW`
- **THEN** the system returns published review posts for the target

#### Scenario: Admin user lists all posts
- **WHEN** an authenticated admin caller sends `GET /posts/?authorUserId=user1`
- **THEN** the system returns all posts by that author regardless of status

### Requirement: Public access to realm listing
The `GET /realms/` endpoint SHALL accept unauthenticated requests. When the caller is not an admin, the system SHALL force `isPublic=true` filter. The `q` parameter SHALL NOT be available on this endpoint.

#### Scenario: Anonymous user lists realms
- **WHEN** an unauthenticated caller sends `GET /realms/?isOfficial=true`
- **THEN** the system returns only public, official realms

#### Scenario: Anonymous user attempts to list private realms
- **WHEN** an unauthenticated caller sends `GET /realms/?isPublic=false`
- **THEN** the system ignores the `isPublic` parameter and returns only public realms

#### Scenario: Admin user lists all realms
- **WHEN** an authenticated admin caller sends `GET /realms/?isPublic=false`
- **THEN** the system returns private realms as requested

### Requirement: Full-text search removed from DB list endpoints
The `q` query parameter SHALL be removed from `bookListQuerySchema`, `postListQuerySchema`, and `realmListQuerySchema` in `@rezics/contract`. The corresponding SQL LIKE logic SHALL be removed from the server service layer. Full-text search SHALL only be available via the `/meili/*` endpoints.

#### Scenario: Request with q parameter
- **WHEN** any caller sends `GET /books/?q=something`
- **THEN** the `q` parameter is ignored (not present in schema) and results are unfiltered by text

### Requirement: Chapters and feedbacks remain admin-only
The `GET /chapters/` and `GET /feedbacks/` endpoints SHALL continue to require admin authentication. No changes to their access control.

#### Scenario: Anonymous user attempts to list chapters
- **WHEN** an unauthenticated caller sends `GET /chapters/`
- **THEN** the system returns 401 or 403
