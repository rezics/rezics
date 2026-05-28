## Manual Verification

Run the app stack from the repository root:

```bash
bun run dev
```

Seed the wiki scenario when local data needs the factory fixtures:

```bash
bun --filter=@rezics/server run seed:factory:fast -- --scenario=wiki-zone-experience --manifest=both
```

The seed manifest prints the exact Unit IDs for the realm, release, and wiki
Zones. Use those IDs with the routes below.

### Realm Wiki Tab

- `http://localhost:5173/realm/<Wiki Zone official realm unitId>`
- Open the `Wiki` tab.
- Confirm the app-themed tab lists WIKI posts sent to the realm and links to the
  configured Zone.

### Wiki Zone Homepages

The wiki Zone slugs are deterministic in the factory scenario:

- `http://localhost:5173/z/factory-wiki-classic`
- `http://localhost:5173/z/factory-wiki-media`
- `http://localhost:5173/z/factory-wiki-database`
- `http://localhost:5173/z/factory-wiki-minimal`

Confirm each page renders navigation, translated labels, homepage sections,
empty-section behavior, and scoped theme styling.

### Release Wiki Context

- `http://localhost:5173/book/<Wiki Zone release unitId>`
- Confirm the release wiki panel resolves the official realm context and links to
  the realm Wiki tab and configured wiki Zone.

### Zone Management

- `http://localhost:5173/realm/<Wiki Zone official realm unitId>/manage`
- Confirm the realm management page can assign the wiki Zone, edit wiki template
  and homepage JSON, create or insert LABEL Units, and create WorkRealmContext
  rows.
