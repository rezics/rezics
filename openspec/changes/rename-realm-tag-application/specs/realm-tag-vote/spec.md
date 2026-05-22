## RENAMED Requirements

### Requirement: RealmTagVote records per-member votes on realm tag applications
FROM: RealmTagVote records per-member votes on realm tag applications
TO: RealmTagApplicationVote records per-member votes on realm tag applications

### Requirement: RealmTagVote write requires realm membership at write time
FROM: RealmTagVote write requires realm membership at write time
TO: RealmTagApplicationVote write requires realm membership at write time

### Requirement: RealmTagVote retention is permanent across membership changes
FROM: RealmTagVote retention is permanent across membership changes
TO: RealmTagApplicationVote retention is permanent across membership changes

### Requirement: RealmTagVote rows are the sole source of RealmTagUnit score
FROM: RealmTagVote rows are the sole source of RealmTagUnit score
TO: RealmTagApplicationVote rows are the sole source of RealmTagApplication score

### Requirement: Creating a RealmTagUnit row writes the creator's first +1 RealmTagVote
FROM: Creating a RealmTagUnit row writes the creator's first +1 RealmTagVote
TO: Creating a RealmTagApplication row writes the creator's first +1 RealmTagApplicationVote

### Requirement: RealmTagVote cascades from the realm tag application
FROM: RealmTagVote cascades from the realm tag application
TO: RealmTagApplicationVote cascades from the realm tag application

## ADDED Requirements

### Requirement: RealmTagApplicationVote names the application as its vote target
The vote model, DTOs, routes, service methods, and tests SHALL use `RealmTagApplicationVote` to make clear that each vote targets one `RealmTagApplication(realmUnitId, tagUnitId, unitId)` row.

#### Scenario: Vote DTO uses application vocabulary
- **WHEN** a consumer imports the realm application vote DTO from `@rezics/contract`
- **THEN** `RealmTagApplicationVoteDTO` SHALL be available
- **AND** `RealmTagVoteDTO` SHALL NOT be exported

#### Scenario: Vote route uses application vocabulary
- **WHEN** a member casts a vote through `POST /realm-tag-application-votes`
- **THEN** the vote SHALL be applied to the matching `RealmTagApplication`
- **AND** the old `/realm-tag-votes` route prefix SHALL NOT remain mounted
