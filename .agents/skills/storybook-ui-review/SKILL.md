---
name: storybook-ui-review
description: Inspect new or changed REZICS UI through Storybook and actual screenshots, then fix issues within the task. Use for visible component, layout, style or copy changes; not research-only requests or nonvisual code changes.
---

# Storybook UI review

The goal is to find problems in the current UI. Screenshot counts and pixel
similarity are not acceptance criteria. Follow the browser authorization boundary
in [AGENTS.md](../../../AGENTS.md) and the runtime instructions in the
[Storybook workflow](../../../docs/architecture/storybook-workflow.md).
For the current implementation program, the
[execution workflow](../../../docs/plan/execution-workflow.md) owns timing:
defer story/test authoring to test-authoring and run this rendered review in
verification. Implementation handoffs record pending review without invoking it.

## Select meaningful evidence

- Identify the intended visible outcome and the affected components. Reuse or
  update existing stories; add stories for meaningful new behavior or states,
  rather than every internal wrapper or route adapter.
- Discover real story IDs with official tools. An empty changed-story result
  does not prove no impact; use component lookup and inspect consumers.
- Cover the changed surface and relevant parent context. Expand coverage when
  shared styles, themes, providers or controls affect multiple consumers. Choose
  viewports, locales and states according to the change instead of generating
  every permutation.

## Inspect and resolve

- Reach the intended state, including interactions when needed. Wait for content,
  fonts and images to settle; verify the running instance, story and viewport.
- Obtain actual screenshots through the available browser tools or the opt-in
  native capture task. The AI must view the images, not merely create files,
  return preview URLs or publish a Review.
- Inspect issues relevant to the task: clipping, overlap, overflow, information
  hierarchy, readable text, state feedback, overlays, focus and responsive layout.
  Relate findings to the intended behavior rather than personal style preferences.
- Fix routine defects within the authorized scope and existing design system,
  then inspect the affected state again. Ask only when a material product/design
  decision or an action outside the authorized scope is necessary.
- Run the affected typechecks, interaction tests and a11y checks. Visual judgment,
  behavior assertions and measured accessibility provide distinct evidence.

## Finish proportionally

Finish when the selected affected states have been viewed, scoped findings have
been addressed, and relevant integrity checks pass. State unverified boundaries.
Recheck after a relevant change or failure; do not repeatedly run unchanged suites.

Review is a way to share relevant stories, not proof that the AI inspected them.
Use it when it helps present the result or the user requests it. A focused task
does not require a repository-wide review, a static build or full-suite reruns.

Generated screenshots, reference images and diffs are temporary and never committed.
Do not establish a persistent pixel-baseline workflow unless the user requests it.
Use `.temp/` for local artifacts; retain only requested deliverables. Product image
assets remain governed by their normal owners.

## Relationship to other skills

Use installed official Storybook skills for current APIs, CSF syntax and tool
arguments. Use MCP/official tools for a running host and the official Vitest addon
for independent tests or CI. This repository policy determines task scope,
evidence and completion, overriding generic defaults requiring a story for every component, full-suite
testing at every handoff, or permission for every routine visual correction.
Use the repository's Storybook runtime and temporary directory when applying a
generic frontend-testing skill. Do not edit installed plugin caches to change policy.
