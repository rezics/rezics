### Requirement: Shared email layout with branded header and footer

All transactional emails SHALL be wrapped in an `EmailLayout` component that renders a consistent header (logo image + "REZICS" text) and footer (copyright year, explanatory line, relevant links). The layout SHALL produce responsive HTML that renders correctly in major email clients (Gmail, Outlook, Apple Mail).

#### Scenario: Email renders with branded layout

- **WHEN** any transactional email is rendered
- **THEN** the output HTML includes a header with the REZICS logo and app name, and a footer with copyright and contextual links

#### Scenario: Logo fallback

- **WHEN** the logo image fails to load in the email client
- **THEN** the alt text "REZICS" SHALL be displayed as fallback

### Requirement: Verification code email template

The `VerificationCode` template SHALL render an email containing a 6-digit verification code displayed prominently, the user's name (or "there" as fallback), and a brief instruction to enter the code in the app. The code SHALL be styled for easy reading (large, monospaced, spaced digits).

#### Scenario: Verification code email content

- **WHEN** a verification code email is rendered with `{ code: "482901", userName: "Edge" }`
- **THEN** the email greets "Edge", displays "482901" prominently, and instructs the user to enter the code in the app

#### Scenario: Verification code email with no name

- **WHEN** a verification code email is rendered with `{ code: "482901", userName: undefined }`
- **THEN** the email greets "there" as fallback

### Requirement: Password reset email template

The `PasswordReset` template SHALL render an email containing a password reset link/button and the user's name. The template SHALL use the `EmailLayout` wrapper.

#### Scenario: Password reset email content

- **WHEN** a password reset email is rendered with `{ url: "https://...", userName: "Edge" }`
- **THEN** the email greets "Edge", contains a reset button/link pointing to the URL, and explains the link expires

### Requirement: Invitation email template

The `Invitation` template SHALL render an email containing the inviter's name, the organization name, and an accept invitation link/button. The template SHALL use the `EmailLayout` wrapper.

#### Scenario: Invitation email content

- **WHEN** an invitation email is rendered with `{ inviterName: "Alice", orgName: "Book Club", url: "https://..." }`
- **THEN** the email mentions Alice invited the recipient to join Book Club, with an accept button

### Requirement: Email change confirmation template

The `EmailChangeConfirm` template SHALL render an email containing a confirmation link/button for the email address change. The template SHALL use the `EmailLayout` wrapper.

#### Scenario: Email change confirmation content

- **WHEN** an email change confirmation is rendered with `{ url: "https://...", userName: "Edge", newEmail: "new@example.com" }`
- **THEN** the email confirms the change to the new address and provides a confirmation link

### Requirement: Render function produces HTML and plain text

The `render()` function SHALL accept a template component with its props and return `{ html: string, text: string }`. The HTML output SHALL be email-client-safe. The text output SHALL be a readable plain-text fallback.

#### Scenario: Render produces both formats

- **WHEN** `render(VerificationCode, { code: "482901", userName: "Edge" })` is called
- **THEN** it returns an object with `html` containing the full branded HTML email and `text` containing a plain-text version

### Requirement: Template registry exports available templates

The package SHALL export a registry of available templates with their names, descriptions, and required prop types. This enables the admin UI to build a template picker and dynamic form.

#### Scenario: Registry lists all templates

- **WHEN** the template registry is imported
- **THEN** it contains entries for VerificationCode, PasswordReset, Invitation, and EmailChangeConfirm, each with name, description, and prop schema
