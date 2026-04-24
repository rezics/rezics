## ADDED Requirements

### Requirement: CLI offers an interactive tweak step after preset selection

The unified seed CLI (`tool/seed/seed.ts`) SHALL offer an interactive tweak step after the user selects a preset and before seeding begins. The tweak step SHALL be entered on an explicit user confirmation (Clack `confirm` or equivalent) and SHALL be skippable so users who want the preset unchanged can proceed directly.

#### Scenario: User declines tweak and proceeds

- **WHEN** the user selects a preset
- **AND** declines the "tweak plan?" confirmation
- **THEN** the CLI SHALL proceed to seeding with the preset's unmodified plan

#### Scenario: User accepts tweak step

- **WHEN** the user selects a preset
- **AND** accepts the "tweak plan?" confirmation
- **THEN** the CLI SHALL write the plan to a temp JSON file and spawn `$EDITOR` on it

#### Scenario: No-interactive flag bypasses the tweak step

- **WHEN** the CLI is launched with `--no-interactive`
- **THEN** no confirmation SHALL be shown
- **AND** the preset's plan SHALL be used unchanged

### Requirement: Temp file location and cleanup

The tweak step SHALL write its temp file under `node_modules/.cache/rezics-seed/`, in a uniquely-named subdirectory created via `fs.mkdtemp(...)`. The temp file SHALL be named `plan.json` within that subdirectory. The subdirectory SHALL be removed in a `try/finally` around the editor spawn, and also from `SIGINT` and `SIGTERM` handlers registered for the duration of the edit step.

Additionally, on every CLI startup the seed system SHALL sweep `node_modules/.cache/rezics-seed/` and remove any `edit-*` subdirectory older than 1 hour.

#### Scenario: Successful tweak cleans up temp file

- **WHEN** the user edits the plan, saves, and the edit completes successfully
- **THEN** the `node_modules/.cache/rezics-seed/edit-<id>/` directory SHALL no longer exist after the edit step returns

#### Scenario: User cancels mid-edit via Ctrl+C

- **WHEN** the user presses Ctrl+C while the editor is open
- **THEN** the SIGINT handler SHALL remove the `node_modules/.cache/rezics-seed/edit-<id>/` directory
- **AND** the CLI SHALL exit with a non-zero status

#### Scenario: Prior-run leftovers are swept

- **WHEN** a `node_modules/.cache/rezics-seed/edit-<old>/` directory exists with an mtime older than 1 hour
- **AND** the CLI is launched
- **THEN** that directory SHALL be removed during startup
- **AND** directories newer than 1 hour SHALL be left alone

#### Scenario: Temp path stays inside the project

- **WHEN** the temp subdirectory is created
- **THEN** its absolute path SHALL be a descendant of the project root
- **AND** SHALL NOT be a descendant of `os.tmpdir()`

### Requirement: Editor resolution

The tweak step SHALL resolve the editor command in this order: `process.env.VISUAL`, then `process.env.EDITOR`, then a platform default (`notepad` on win32, `vi` on darwin/linux). If the resolved command is not found on `PATH`, the CLI SHALL abort the tweak step with a Clack error naming `VISUAL` / `EDITOR` as the env vars to set.

#### Scenario: VISUAL takes precedence over EDITOR

- **WHEN** both `VISUAL=code` and `EDITOR=vi` are set
- **THEN** the tweak step SHALL spawn `code`

#### Scenario: Missing editor surfaces a clear error

- **WHEN** `VISUAL` and `EDITOR` are unset
- **AND** the platform default (e.g. `vi`) is not installed on `PATH`
- **THEN** the CLI SHALL print a Clack error instructing the user to set `VISUAL` or `EDITOR`
- **AND** SHALL exit the tweak step without attempting to seed

### Requirement: Plan validation round-trip

After the editor exits, the tweak step SHALL read the temp file, parse it as JSON, and validate it against the `SeedPlan` schema implemented with Valibot. On validation failure, the CLI SHALL display the failing path(s) and message(s) via Clack and prompt the user with "edit again?" / "cancel". On "edit again", the CLI SHALL re-open the same temp file, preserving the user's most recent content rather than reverting to the preset defaults.

#### Scenario: Valid plan proceeds to seeding

- **WHEN** the user saves a plan that validates against the schema
- **THEN** the CLI SHALL exit the tweak step and begin seeding with the parsed plan

#### Scenario: Invalid plan offers re-edit

- **WHEN** the user saves a plan that fails validation (e.g. `max` missing on a `CountSpec`)
- **THEN** the CLI SHALL display the validation path and message
- **AND** SHALL prompt "edit again?" with a default of yes
- **AND** on "yes", SHALL re-open the editor on the same file with the user's latest content preserved

#### Scenario: Validation blocks unknown top-level fields

- **WHEN** the user's edited plan contains a top-level field not present in the schema
- **THEN** validation SHALL fail and the user SHALL be re-prompted to edit

#### Scenario: User cancels re-edit prompt

- **WHEN** the user declines the "edit again?" prompt after a validation failure
- **THEN** the CLI SHALL clean up the temp file and exit with a non-zero status
- **AND** SHALL NOT begin seeding
