## 1. Active Code Cleanup

- [x] 1.1 Remove retired Meili query stubs and mapper stubs.
- [x] 1.2 Replace app callsites that import route objects through router
      forwarding exports with direct route imports.
- [x] 1.3 Remove old contract helper exports and no-op UI transition props.
- [x] 1.4 Remove remaining active migration-era helper surfaces where callsites can use
      the canonical API directly.

## 2. Documentation And Specs

- [x] 2.1 Update active specs that require now-removed forwarding names or transition
      behavior.
- [x] 2.2 Keep archived changes and third-party/external protocol requirement
      wording intact.

## 3. Validation

- [x] 3.1 Re-run repository searches for migration-era terms in active
      packages.
- [x] 3.2 Run focused type/test verification for touched packages.
