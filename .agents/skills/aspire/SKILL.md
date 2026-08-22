---
name: aspire
description: Operate, diagnose, or modify an Aspire AppHost or Aspire-managed resources. Use only when the requested work directly involves the Aspire CLI, an AppHost, or Aspire-managed resource lifecycle, topology, deployment, or telemetry. Do not use merely because a repository contains or mentions Aspire, including when reviewing ordinary application code, package or workspace organization, documentation, or reports that require no Aspire-specific action or decision.
metadata:
  version: "1.1.0"
---

# Aspire

## Scope gate

Use this skill only when the requested outcome requires an Aspire-specific operation or
decision. The presence of `aspire.config.json`, an AppHost, generated Aspire files, or an
Aspire-related passage in background material is not enough.

If the task is about an application's own code, repository structure, package boundaries,
documentation, or a general development workflow, use the owner of that work instead.

## Workflow

1. Find the rooted Aspire configuration and AppHost. Detect its language and project style
   from configuration and project files rather than from assumptions.
2. Inspect repository scripts, task runners, and pinned tool versions before choosing raw
   Aspire CLI commands. Prefer wrappers that prepare required dependencies and environment.
3. For runtime failures, inspect the resource model, health, endpoints, logs, and telemetry
   before changing code.
4. Choose the narrowest operation that matches the task: an AppHost edit, a resource command,
   a lifecycle action, integration restore, diagnostics, or deployment work.
5. Change authored AppHost sources and configuration only. Regenerate derived artifacts with
   Aspire tooling.
6. Validate with the repository's checks. Restore integrations and run the language's static
   checks when AppHost packages, generated APIs, or authored topology changed.
7. Restart only the scope whose model or runtime requires it. Clean up processes when cleanup
   is part of the task.

Read [references/apphost-authoring.md](references/apphost-authoring.md) before authoring or
reviewing an AppHost. Read
[references/lifecycle-diagnostics.md](references/lifecycle-diagnostics.md) before starting,
stopping, waiting for, or diagnosing resources.

## Guardrails

- Run agent-driven CLI operations non-interactively and request structured output when parsing
  state.
- Discover resource names and endpoints from Aspire instead of guessing names or ports.
- Search current Aspire documentation before using an unfamiliar CLI option, integration, or
  builder API.
- Do not expose parameter or secret values in commands, logs, reports, or diagnostic bundles.
- Do not replace repository-owned lifecycle, infrastructure, or deployment workflows unless
  the task explicitly changes them.
- Do not run destructive deployment or teardown commands without explicit authorization for
  the exact target.
