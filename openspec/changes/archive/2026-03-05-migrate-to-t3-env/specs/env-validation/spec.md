## ADDED Requirements

### Requirement: Strict Environment Validation at Startup
The system SHALL validate all environment variables configured for each application at startup.

#### Scenario: Application startup with missing variables
- **WHEN** an application starts and requires a mandatory environment variable that is missing
- **THEN** the application throws an immediate initialization error detailing the missing variables preventing startup

#### Scenario: Application startup with valid variables
- **WHEN** an application starts with all required environment variables properly supplied
- **THEN** the application initializes successfully and exposes a strongly-typed `env` object for internal use

### Requirement: Client vs Server Environment Segregation
The system SHALL properly distinguish between frontend and backend environment variables.

#### Scenario: Accessing frontend variables
- **WHEN** validating frontend application variables
- **THEN** the `env` config uses `clientPrefix: "VITE_"` and validates variables from `import.meta.env`

#### Scenario: Accessing backend variables
- **WHEN** validating backend application variables
- **THEN** the `env` config validates variables from `process.env` without client prefixes
