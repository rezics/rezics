## ADDED Requirements

### Requirement: Admin email testing page exists

The admin dashboard SHALL include an email testing page at `/admin/auth/email` (or similar path under the auth section). The page SHALL be accessible only to admin-role users.

#### Scenario: Admin navigates to email testing

- **WHEN** an admin user navigates to the email testing page
- **THEN** they see a template picker, preview area, and send controls

### Requirement: Template preview

The email testing page SHALL allow the admin to select any available email template from a dropdown/picker (populated from `@rezics/email`'s template registry). Upon selection, the page SHALL render a live preview of the template with sample/editable data.

#### Scenario: Preview verification code template

- **WHEN** the admin selects "Verification Code" template
- **THEN** a form appears with fields for `code` and `userName`, and the preview updates in real-time as values are edited

#### Scenario: Preview updates dynamically

- **WHEN** the admin changes a field value in the template form
- **THEN** the preview re-renders immediately with the new values

### Requirement: Test email send

The email testing page SHALL allow the admin to enter a recipient email address and send a test email using the selected template and current form data. The send SHALL go through the auth service's email infrastructure (SMTP).

#### Scenario: Send test email

- **WHEN** the admin fills in template data, enters a recipient address, and clicks "Send Test"
- **THEN** the auth service renders the template and sends it via SMTP to the specified address

#### Scenario: Send confirmation

- **WHEN** a test email is sent successfully
- **THEN** the page shows a success message with the recipient address

#### Scenario: Send failure

- **WHEN** the SMTP send fails (bad address, connection error)
- **THEN** the page shows an error message with details

### Requirement: SMTP diagnostics

The email testing page SHALL include an SMTP connection test that verifies the auth service can connect to the configured SMTP server. It SHALL display connection status, server response, and any errors.

#### Scenario: SMTP connection test success

- **WHEN** the admin clicks "Test SMTP Connection"
- **THEN** the page displays the SMTP host, port, and a success/connected status

#### Scenario: SMTP connection test failure

- **WHEN** the SMTP server is unreachable or credentials are invalid
- **THEN** the page displays the error details (connection refused, auth failed, etc.)

### Requirement: Auth service exposes admin email API endpoints

The auth service SHALL expose internal/admin API endpoints for:
1. Listing available email templates (template names + prop schemas)
2. Sending a test email (template name + props + recipient address)
3. Testing SMTP connectivity

These endpoints SHALL be protected by admin authentication.

#### Scenario: List templates endpoint

- **WHEN** an admin calls the list-templates endpoint
- **THEN** it returns the template registry with names, descriptions, and prop schemas

#### Scenario: Send test email endpoint

- **WHEN** an admin calls the send-test endpoint with `{ template: "verification-code", props: { code: "123456", userName: "Test" }, to: "admin@example.com" }`
- **THEN** the auth service renders the template and sends it via SMTP

#### Scenario: Non-admin access is rejected

- **WHEN** a non-admin user calls any email testing endpoint
- **THEN** the request is rejected with 403 Forbidden
