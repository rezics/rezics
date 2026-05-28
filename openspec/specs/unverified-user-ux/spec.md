# unverified-user-ux Specification

## Purpose

Defines the unfinished-registration UX that runs alongside
authentication. Owns the compact header `PendingVerificationSection`
that surfaces a "Complete Registration" link plus a "Logout"
button whenever the user is missing a `UserProfile` or has an
unverified email, and ensures the prompt persists across all
routes until both steps complete.

## Requirements

### Requirement: Compact registration prompt in header toolbar

The `PendingVerificationSection` component (or its replacement) SHALL display a compact "Complete Registration" prompt linking to `/complete-registration`. It SHALL show a "Complete Registration" action button and a "Logout" button. The prompt SHALL appear whenever the user's registration is incomplete (missing UserProfile OR unverified email), not only for unverified email.

#### Scenario: Header shows registration prompt for user missing identity

- **WHEN** a user with no `UserProfile` (Step 1 incomplete) is viewing any page
- **THEN** the header toolbar SHALL show a "Complete Registration" action and a "Logout" button

#### Scenario: Header shows registration prompt for unverified email

- **WHEN** a user with `emailVerified: false` (Step 2 incomplete) is viewing any page
- **THEN** the header toolbar SHALL show a "Complete Registration" action and a "Logout" button

#### Scenario: Header shows authenticated section for fully registered user

- **WHEN** a user with both `UserProfile` and `emailVerified: true` is viewing any page
- **THEN** the header toolbar SHALL show the normal authenticated section (avatar, profile menu, etc.)

### Requirement: Unverified users browse as guests

Unverified users (authenticated with auth service but registration incomplete) SHALL have the same browsing permissions as unauthenticated guests. They SHALL be able to navigate all public pages, view content, and use search without restriction.

#### Scenario: User with incomplete registration browses content

- **WHEN** a user with incomplete registration navigates to a book page, shelf, or the homepage
- **THEN** the content SHALL load normally, identical to what a guest would see

### Requirement: Auth-gated actions show registration prompt for incomplete users

When a user with incomplete registration attempts an action that requires full authentication (e.g., commenting, reacting, adding to readlist), the UI SHALL display a prompt saying "Complete registration to [action]" instead of "Sign in to [action]" or "Verify your email to [action]". The prompt SHALL link to `/complete-registration`.

#### Scenario: Incomplete user tries to comment

- **WHEN** a user with incomplete registration attempts to post a comment
- **THEN** a prompt SHALL appear saying "Complete registration to comment" with a link to `/complete-registration`

#### Scenario: Guest user tries to comment

- **WHEN** a guest (unauthenticated) user attempts to post a comment
- **THEN** a prompt SHALL appear saying "Sign in to comment" with a link to `/login`
