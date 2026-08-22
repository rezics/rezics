# Lifecycle and diagnostics

## Prefer repository workflows

Inspect task runners and package or project scripts first. A repository wrapper may load
configuration, prepare infrastructure, isolate ports, select the intended AppHost, or own
cleanup. Do not replace those guarantees with an ad hoc command sequence.

For raw Aspire operations, specify the AppHost when discovery could be ambiguous, use
`--non-interactive` for agent execution, and request JSON when consuming command output.
Discover the exact syntax from the pinned CLI rather than assuming a different version's
surface.

## Investigate before editing

Use Aspire's model and telemetry to distinguish an AppHost problem from an application,
dependency, configuration, or infrastructure failure:

1. Describe or list resources to inspect state, health, and endpoints.
2. Inspect structured telemetry and resource logs for the failing scope.
3. Inspect traces when a failure crosses resources.
4. Export a diagnostic bundle only when requested, after checking that it will not disclose
   secrets.

Do not poll guessed ports. Wait on the named resource or discover its endpoint through Aspire
before interacting with it.

## Choose the smallest lifecycle action

- Restart the AppHost when the application model changed.
- For one resource's implementation change, prefer its own watch or hot-reload behavior, an
  exposed resource command, or a resource-scoped restart.
- Restore integrations when generated modules or packages are missing or stale.
- Stop only the selected AppHost or resource unless the task also requires stopping external
  infrastructure.
- Treat deployment destroy and teardown as separate, explicitly authorized operations.
