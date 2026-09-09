---
name: external-content-value
description: Write, revise or audit REZICS external content, including UI copy, localization, public documentation and showcase metadata. Use when changing audience-facing text; internal logs, tests, comments and maintainer documentation are outside scope unless their audience value is explicitly under review.
metadata:
  version: "1.1.0"
---

# External Content Value

Keep text when it helps its intended audience identify a subject, answer a
question, act or decide, understand a non-obvious consequence or constraint,
or satisfy an accessibility, safety, rights, provenance or trust need.

## Ordinary edits

Inspect the consuming surface and nearby text. Ask what the audience would lose
if the text were removed. Keep useful information, rewrite it around the
audience-visible outcome, relocate specialist detail, or omit valueless copy.
Optional fields may stay empty.

Apply this judgment to the affected text; a small edit does not require a
formal audit table or another reviewer. Inspect all consumers before narrowing
or deleting a shared string. Do not invent facts, user needs or product behavior
to justify copy, or apply mechanical bans on words and sentence patterns.

Preserve material warnings and consequences. Keep implementation rationale in
maintainer documentation unless it changes what the external audience needs
to understand. Change a valueless required field only when the task permits
the content-model change; otherwise report the constraint.

## Audits and ambiguous cases

Read [content-value-review.md](references/content-value-review.md) for a
requested audit, unresolved audience need, or cross-surface review. Use its
categories and record format only where they help explain decisions.

## Completion

Verify the changed text in its source context and follow the owner's
[localization policy](../../../libraries/i18n/README.md) and deterministic
checks. Follow the [AGENTS.md verification boundary](../../../AGENTS.md#data-and-verification-boundaries):
scoped Storybook checks for covered UI are already authorized; full-application
rendered QA requires the user's explicit request. For visible copy changes, use
the [Storybook UI review skill](../storybook-ui-review/SKILL.md).
Finish when the affected text serves its audience and required checks pass;
report unresolved factual or terminology decisions without expanding the audit.
