### Requirement: Unverified users browse as guests

Unverified users (authenticated with auth service but `email_verified: false`) SHALL have the same browsing permissions as unauthenticated guests. They SHALL be able to navigate all public pages, view content, and use search without restriction.

#### Scenario: Unverified user browses content

- **WHEN** an unverified user navigates to a book page, shelf, or the homepage
- **THEN** the content loads normally, identical to what a guest would see

#### Scenario: Unverified user uses search

- **WHEN** an unverified user uses the search feature
- **THEN** search works identically to guest search

### Requirement: Compact verification prompt in header toolbar

The `PendingVerificationSection` component SHALL be redesigned to display a compact verification prompt. It SHALL show a "Verify Email" action button that links to `/verify-email` and a "Logout" button. It SHALL NOT display the user's email address or multi-line status text in the toolbar.

#### Scenario: Header shows verification prompt

- **WHEN** an unverified user is viewing any page
- **THEN** the header toolbar shows a compact "Verify Email" action and a "Logout" button

#### Scenario: Verify Email navigates to verification page

- **WHEN** the user clicks "Verify Email" in the toolbar
- **THEN** they navigate to `/verify-email`

#### Scenario: Logout clears auth state

- **WHEN** the user clicks "Logout" in the toolbar
- **THEN** the auth session is cleared and the user becomes a guest

### Requirement: Remove in-page verification banner from MainLayout

The `MainLayout` SHALL NOT render the email verification warning banner (`shouldShowVerificationBanner` logic and the `Alert` component). The toolbar prompt is the sole verification indicator.

#### Scenario: No banner in main layout

- **WHEN** an unverified user views any page with MainLayout
- **THEN** no warning banner appears below the header; only the toolbar prompt is visible

### Requirement: Auth-gated actions show "verify email" prompt for unverified users

When an unverified user attempts an action that requires authentication (e.g., commenting, reacting, adding to readlist), the UI SHALL display a prompt saying "Verify your email to [action]" instead of "Sign in to [action]". The prompt SHALL link to `/verify-email`.

#### Scenario: Unverified user tries to comment

- **WHEN** an unverified user attempts to post a comment
- **THEN** a prompt appears saying "Verify your email to comment" with a link to `/verify-email`

#### Scenario: Guest user tries to comment

- **WHEN** a guest (unauthenticated) user attempts to post a comment
- **THEN** a prompt appears saying "Sign in to comment" with a link to `/login`

### Requirement: Verify-email page includes logout capability

The `/verify-email` page SHALL include a visible logout/exit button that allows users to sign out and return to guest browsing. This ensures users are never trapped in the verification flow.

#### Scenario: Logout from verify-email page

- **WHEN** the user clicks "Logout" on the `/verify-email` page
- **THEN** the auth session is cleared and the user is redirected to the homepage as a guest

### Requirement: Auto-navigate to verify-email after login

After a successful login where `email_verified === false`, the app SHALL automatically navigate to `/verify-email`. This is a soft navigation, not a hard gate — the user can navigate away freely afterward.

#### Scenario: Post-login redirect for unverified user

- **WHEN** a user logs in with unverified email
- **THEN** they are navigated to `/verify-email` automatically

#### Scenario: User navigates away from verify-email

- **WHEN** an unverified user navigates away from `/verify-email` (via browser back, URL bar, or clicking a link)
- **THEN** navigation proceeds normally; the user browses as a guest with the toolbar prompt visible
