# shared-email-sender Specification

## Purpose

Defines shared nodemailer sender creation in `@rezics/email` with service-owned env/config inputs. The shared package provides reusable sender utilities alongside templates and rendering, but never reads `process.env` itself; auth, main, and notify each read their own environment and pass explicit transport and sender configuration to the shared sender.

## Requirements

### Requirement: Shared email package provides sender creation
`@rezics/email` SHALL provide reusable nodemailer sender creation utilities alongside email templates and rendering. The sender utility SHALL accept explicit transport and sender configuration from the caller.

#### Scenario: Service creates sender from local env
- **WHEN** auth, main, or notify needs to send email
- **THEN** that service SHALL read and validate its own environment variables
- **AND** it SHALL pass explicit SMTP and sender config to `@rezics/email`
- **AND** `@rezics/email` SHALL create the nodemailer sender from the provided config

### Requirement: Shared email package does not read service env
`@rezics/email` SHALL NOT read `process.env` or import service-specific env modules. Environment ownership SHALL remain in each caller package.

#### Scenario: Email package is imported
- **WHEN** a package imports sender utilities from `@rezics/email`
- **THEN** importing the package SHALL NOT validate or read auth, main, notify, or server environment variables
- **AND** tests SHALL be able to instantiate a sender with explicit in-memory config

### Requirement: Verification email delivery returns typed failures
Verification flows using `@rezics/email` sender utilities SHALL surface delivery success or typed delivery failure to the caller. They SHALL NOT use fire-and-forget notification fanout when the user action depends on delivery.

#### Scenario: SMTP send fails during verification
- **WHEN** the sender fails to deliver a verification email
- **THEN** the calling service SHALL receive a typed failure
- **AND** the API SHALL be able to return a recoverable typed error to the frontend

### Requirement: Server email env documentation is complete
Main server env validation and `.env.example` documentation SHALL include all SMTP and sender variables that main passes to `@rezics/email`.

#### Scenario: Developer configures main email verification
- **WHEN** a developer opens the main server env example
- **THEN** the documented variables SHALL include `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIN_EMAIL_FROM_EMAIL`, and `MAIN_EMAIL_FROM_NAME`
- **AND** the variable descriptions SHALL state that main passes these values to `@rezics/email`
