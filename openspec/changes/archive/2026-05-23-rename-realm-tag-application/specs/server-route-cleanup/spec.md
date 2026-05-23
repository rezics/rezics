## ADDED Requirements

### Requirement: Server route cleanup uses RealmTagApplication names
Server route documentation and route summaries SHALL refer to `RealmTagApplication` for realm-scoped tag classification routes. Route cleanup specs SHALL NOT describe the triple-level application row as `RealmTagUnit`.

#### Scenario: Realm classification routes use new names
- **WHEN** OpenAPI details are generated for realm-scoped tag classification
- **THEN** create, patch, delete, and vote summaries SHALL use `RealmTagApplication` or `RealmTagApplicationVote` vocabulary
- **AND** no generated summary SHALL describe the route as managing `RealmTagUnit`
