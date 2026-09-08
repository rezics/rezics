# AppHost authoring

## Find the authored boundary

- Read the rooted `aspire.config.json` when present and follow its AppHost path and language.
- Follow the configured project style. REZICS owns a TypeScript AppHost under
  `aspire-apphost/`; its Taskfile owns restore and typechecking.
- Inspect the AppHost's package or project definition and the applications it orchestrates
  before changing their relationship.

Edit authored sources and configuration. `aspire-apphost/.aspire/modules/`
contains generated SDK code; inspect declarations when useful and regenerate
through the owning restore task when SDK inputs change.

## Author from verified APIs

Use the repository's pinned Aspire version as the compatibility target. Search current docs
before relying on an unfamiliar API:

```text
aspire docs search "<topic>"
aspire docs api search "<builder or resource API>" --language <csharp|typescript>
```

- Pass resource, endpoint, parameter, and connection-string references instead of copying
  resolved values or hard-coding discovered ports.
- Express a startup dependency only when the consumer genuinely cannot start without it.
- Model secrets through Aspire's secret-aware parameter facilities and keep their values out of
  source and output.
- Keep probes aligned with the health contract owned by the application.
- Preserve the repository's application, infrastructure, and deployment ownership boundaries
  unless the requested topology change requires moving one.

## Validate the change

Restore generated integrations when packages or SDK inputs changed, run the AppHost language's
static checks, and use the repository's bounded integration or smoke workflow when topology,
endpoint wiring, dependency order, or probes changed. Do not start a long-lived development
session solely to validate an edit when a bounded check exists.
