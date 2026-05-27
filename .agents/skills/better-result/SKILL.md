---
name: better-result
description: Repository guardrails for when better-result may be used in rezics.
---

# better-result Policy

This skill defines the repository-specific rule for `better-result`.

## Default Stance

Do not introduce `better-result` proactively.

In this repository, `better-result` is **not** the default error-handling approach. Even though the dependency may exist in the workspace, agents should prefer the project's existing local patterns unless one of the explicit allow-cases below applies.

## Use `better-result` Only When

- The user explicitly asks to use `better-result`
- The user explicitly asks for Result-style or TaggedError-style refactoring
- The code being modified already imports or returns `better-result` types
- The task is specifically about the bundled child skills:
  - adopting `better-result` in an existing area
  - migrating existing `better-result` code to v2 APIs

## Do Not Use `better-result` When

- The user asks for general error handling improvements without naming the library
- You are implementing a new feature in an area that does not already use `better-result`
- You are fixing a bug and standard TypeScript control flow is sufficient
- You are tempted to introduce `Result`, `TaggedError`, or related helpers only because they look cleaner

## Preferred Alternatives

Unless the task explicitly opts into `better-result`, follow the surrounding package's existing style:

- Keep current return types and exception boundaries
- Use normal TypeScript unions, discriminated objects, or framework-native error handling
- Minimize architectural churn during bug fixes and feature work
- Match the conventions already present in the target module

## Decision Check

Before using `better-result`, confirm at least one of these is true:

1. The user explicitly requested it.
2. The target files already use it.
3. The task is an explicit migration of existing `better-result` code.

If none are true, do not introduce the library.

## Child Skills

- `adopt/`: Use only for explicit opt-in adoption work
- `migrations/v2/`: Use only when migrating existing `better-result` code
