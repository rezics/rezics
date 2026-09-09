---
name: aspire
description: Operate or diagnose Aspire-managed resources and edit AppHost topology. Use for Aspire CLI, lifecycle, integration or telemetry work; ordinary application code, repository organization and documentation do not trigger this skill merely by mentioning Aspire.
metadata:
  version: "1.2.0"
---

# Aspire

For Storybook lifecycle, use `task aspire:storybook` and discover the three
resources through `task aspire:describe`. The Storybook-only mode and its bounded
`aspire-apphost:storybook:smoke` task do not prepare infrastructure or databases.
Use the [UI review skill](../storybook-ui-review/SKILL.md) for visual evidence;
starting these resources does not authorize or trigger a bulk screenshot run.

Use the repository's rooted `aspire.config.json` and
[AppHost tasks](../../../aspire-apphost/Taskfile.yml) to select the authored
AppHost, pinned tools and lifecycle wrappers. Discover resource names and
endpoints from the model instead of guessing ports.

## Choose the relevant workflow

- For AppHost authorship or topology review, read
  [apphost-authoring.md](references/apphost-authoring.md).
- For runtime failures or resource lifecycle operations, read
  [lifecycle-diagnostics.md](references/lifecycle-diagnostics.md). Use health,
  logs and traces to distinguish application failures from orchestration failures.

## Operating boundaries

Use non-interactive CLI options and structured output when parsing state.
Verify unfamiliar CLI options and builder APIs against the pinned tool and
official docs. Edit authored inputs and regenerate derived SDK files.

Preserve repository lifecycle ownership and restart only the affected scope.
Keep parameter and secret values out of commands, logs and diagnostic artifacts.
Destructive deployment or teardown requires authorization for the exact target;
existing authorization within that scope does not need to be requested again.

Validate the affected contract with the owning static or bounded runtime checks.
A runtime check must fit the task's authorization and the repository frontend
verification boundary. Stop when the requested operation is verified or report
the specific missing evidence; do not repeatedly restart healthy resources.
