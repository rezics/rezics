# Production migration generation

The active implementation phase uses `task services-main:db:generate:typed -- name`
to produce SQL and update `src/services/database/typed-schema.generated.json`
without connecting to a database. It uses the same Drizzle compiler, partition
adapters and canonical SQL composer as the replay-based generation path. Generation
is production artifact creation, not schema, runtime or installation qualification.

The anchor contains the exact typed model, native baseline digest, migration-file
digests and physical partition registrations. Initialize it once at the current
migration tip, before changing the typed schema, with
`task services-main:db:generate:typed -- --initialize`. Initialization refuses to
replace an existing anchor. The first anchor records the intended model of the
existing generated migration tip; it does not prove that an installed database
matches that model.

The anchor is ignored by Git. On a fresh checkout, `task artifacts:prepare`
restores pinned schema inputs, emits the Drizzle declarations and initializes the
missing anchor at the checked-out migration tip. `task artifacts:generate` only
initializes it if missing; neither command overwrites an existing migration anchor
or changes migration SQL. Released-history checks and database replay remain the
independent guards for committed SQL integrity and installation.

After editing the owning schema and canonical SQL, generate one coherent migration.
The tool rejects changed/deleted/replaced history, a different baseline, incompatible
snapshot versions and implicit changes to an existing partition layout. New physical
partition parents use the existing adapters; full-schema export keeps its complete
parent-presence guards. Canonical file/bundle selection and transaction-mode safety
remain with the existing composer. Shadow-validation and overlay-only modes stay
with their owning replay workflow and cannot be smuggled through this path.

Both artifact writers serialize on `.temp/migration-artifact-generation.lock`.
A process failure can leave that lock; inspect the recorded process before removing
it. Neither age nor an observation timeout establishes that its writer stopped.
On a generation error, the new writer restores its prior checksum and model anchor
and removes only its own draft. Checksum refresh is artifact generation; it does not
waive released-history policy. Review SQL and model changes together before commit.

The existing `db:generate` path still provides replay-based generation when its
phase permits it, and refreshes an existing typed anchor after success. It retains
its target-protection preconditions. `db:check`, static checks and test fixtures
remain unchanged and deferred to verification. Generated metadata contains no gate
status; acceptance remains in the plan and testing owners.
