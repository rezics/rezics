## ADDED Requirements

### Requirement: Domain and feature folders are singular
All folders representing a domain, feature, sub-feature, or bounded context SHALL use singular names. This applies to every folder under `package/*/src/**` that is not on the plural-container allowlist (see below) and is not a generated output directory.

#### Scenario: Domain folder is singular
- **WHEN** a developer creates `package/server/src/book/`
- **THEN** the convention check passes

#### Scenario: Domain folder is plural
- **WHEN** a developer creates `package/server/src/books/`
- **THEN** the convention check fails and directs the developer to rename to `book/`

#### Scenario: Compound-name domain folder
- **WHEN** a developer creates `package/app/src/book-library/` or `package/server/src/translation-group/`
- **THEN** the convention check passes because the head noun is singular

### Requirement: Container folders use plural from a fixed allowlist
Folders that contain multiple same-kind files SHALL use plural names drawn from a fixed allowlist. The allowlist is: `hooks`, `utils`, `components`, `pages`, `sections`, `states`, `models`, `types`, `routes`, `handlers`, `providers`, `plugins`, `styles`, `helpers`, `constants`, `fixtures`, `mocks`, `layouts`, `assets`, `tokens`, `docs`, `templates`, `parts`, `forms`, `kinds`, `presets`. Folders outside this allowlist SHALL be singular per the preceding requirement.

#### Scenario: Allowlisted plural container passes
- **WHEN** a developer creates `package/app/src/book-library/hooks/`
- **THEN** the convention check passes

#### Scenario: Non-allowlisted plural folder fails
- **WHEN** a developer creates `package/app/src/book-library/widgets/`
- **THEN** the convention check fails because `widgets` is not on the allowlist; the fix is either to rename to singular `widget/` or to propose a spec amendment adding `widgets` to the allowlist

#### Scenario: Singular form of an allowlisted name fails
- **WHEN** a developer creates `package/app/src/book-edit/hook/`
- **THEN** the convention check fails because `hook` is the singular form of the allowlisted container `hooks`; the fix is to rename to `hooks/`

#### Scenario: `util` vs `utils`
- **WHEN** a developer creates `package/app/src/search/util/`
- **THEN** the convention check fails and requires renaming to `utils/`

### Requirement: Singular domain names with semantically distinct plural containers are permitted
A small allowlist of singular domain folder names SHALL be permitted even when their plural form is on the plural-container allowlist, because the two names carry distinct semantics (one is a domain/feature folder; the other is a container of same-kind files). The current singular-domain exception set is: `token`. Adding to this set requires a spec amendment, just like adding to the plural-container allowlist.

#### Scenario: `token` domain folder coexists with `tokens` container
- **WHEN** a developer creates `package/server/src/token/` containing `token.api.ts`, `token.service.ts`, etc. (the JWT/auth-token domain)
- **AND** the codebase also has `package/ui/src/config/tokens/` (the design-token container)
- **THEN** both pass the convention check, because `token` is on the singular-domain exception list and `tokens` is on the plural-container allowlist

#### Scenario: Other singulars are not auto-exempted
- **WHEN** a developer creates `package/app/src/hook/` (singular form of allowlisted `hooks`)
- **THEN** the convention check fails per the preceding requirement; `hook` is not on the singular-domain exception list, so it must be renamed to `hooks/`

### Requirement: Generated and vendored folders are exempt
Folders produced by code generators or vendored from third-party sources SHALL be exempt from this spec. The exemption set is: `**/prisma/generated/**`, `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/.output/**`, `**/.next/**`, `**/.vite/**`, `**/coverage/**`.

#### Scenario: Prisma generated models folder
- **WHEN** the convention check encounters `package/server/prisma/generated/models/`
- **THEN** the folder is skipped without evaluation

#### Scenario: Build artifact folder
- **WHEN** the convention check encounters `package/app/dist/`
- **THEN** the folder is skipped without evaluation

### Requirement: Allowlist changes require spec amendment
Adding a new plural container folder name to the allowlist SHALL require amending this spec via the normal OpenSpec change workflow. Authors MUST NOT bypass the check by adding suppression comments or local overrides.

#### Scenario: Proposing a new container name
- **WHEN** a feature genuinely needs a new plural container folder (e.g., `layouts/`)
- **THEN** the author opens an OpenSpec change that modifies this requirement's allowlist, and only after archive may use the new name

#### Scenario: Developer attempts local override
- **WHEN** a developer adds a suppression mechanism (ignore file, inline comment) to exempt a single folder from the check
- **THEN** the convention check's configuration SHALL NOT honor per-folder overrides; the only escape is via spec amendment

### Requirement: Feature standard doc aligns with convention
`package/app/docs/feature standard.md` SHALL be updated so its folder-structure examples use plural containers (`hooks/`, `utils/`, `components/`, `sections/`, `pages/`, `states/`, `models/`) and singular domain/sub-feature folders. The document SHALL link to this spec as the authoritative source rather than restating the rules.

#### Scenario: Feature standard shows new structure
- **WHEN** a developer reads `package/app/docs/feature standard.md`
- **THEN** its examples show `hooks/` and `utils/` (both plural), with a link pointing to `openspec/specs/folder-naming-convention/spec.md`

#### Scenario: Doc restates rules in full
- **WHEN** a maintainer considers duplicating the allowlist inside the feature standard doc
- **THEN** they SHALL link to this spec instead, to avoid drift between two sources

### Requirement: Scope covers all packages except auth
The folder naming convention SHALL apply to `package/admin`, `package/api`, `package/app`, `package/contract`, `package/editor`, `package/email`, `package/folio`, `package/i18n`, `package/jwt`, `package/notify`, `package/preview`, `package/reaction`, `package/search`, `package/server`, `package/shared`, and `package/ui`. `package/auth` is explicitly out of scope because it follows better-auth's project structure.

#### Scenario: Auth folder is skipped
- **WHEN** the convention check runs
- **THEN** folders under `package/auth/` are not evaluated against the domain/container rules
