---
title: Headed Browser Investigation Workbench
status: active
created: 2026-06-09
completed:
supersededBy:
tags: [agents, skills, tooling, browser, playwright]
---

## Why

Agents sometimes need to inspect a live URL with a user-provided selector,
Playwright locator, or exact text target, but ordinary fetch/headless automation
can be blocked by Cloudflare, login, captcha, or other human verification flows.
The repo should provide a headed Playwright workbench that lets the agent open a
real browser, hand control to the user for verification when needed, then resume
with scriptable inspection.

This is not a polished flag-driven CLI. The useful shape is a tracked
`tool/browser-inspect` base with helpers and examples plus an ignored scratch
folder where the agent writes task-specific TypeScript scripts. That keeps
complex locators, multi-step page flows, screenshots, DOM copying, and DevTools
inspection easy without expanding a command argument surface.

## Durable constraints & decisions

- `(comment)` The workbench is an agent scratchpad, not a stable public CLI API.
  Keep durable browser/session/style helpers tracked, but let one-off
  investigation scripts live in an ignored folder.
- `(test)` The ignored scratch folder must not appear as untracked work after an
  agent creates investigation scripts there.
- `(comment)` Headed browser sessions intentionally remain open until the user
  or agent explicitly closes them. Do not put automatic browser cleanup in the
  default helper path because the user may need screenshots, DevTools, or manual
  DOM/CSS copying.
- `(comment)` Use a persistent browser profile for this workbench so Cloudflare,
  login, consent, and other verification state can survive across repeated
  investigation scripts.
- `(test)` Locator helpers support Playwright-first targeting styles:
  `page.locator(...)`, `page.getByText(...)`, and traditional CSS selectors
  through ordinary Playwright code in scratch scripts.
- `(test)` Style inspection returns enough computed style and box data to reason
  about visible typography and layout: text content, HTML snippet, bounding box,
  display/position, font, color, background, spacing, border, and visibility.
- `(comment)` The skill must tell agents to use this headed path only when a live
  URL investigation needs human/browser state or when the user explicitly asks
  for browser-backed selector/style inspection.

## Tasks

## 1. Workbench Shape

- [ ] 1.1 Add `tool/browser-inspect/README.md` describing the headed browser
  workbench, the ignored scratch model, and the expected agent/user handoff.
- [ ] 1.2 Add `tool/browser-inspect/src/` helper modules for launching a headed
  persistent Playwright browser, opening a page, pausing for user verification,
  highlighting locators, collecting locator summaries, and dumping computed
  styles.
- [ ] 1.3 Add a tracked starter script such as
  `tool/browser-inspect/template.ts` that shows direct use of
  `page.locator(...)`, `page.getByText(...)`, CSS selectors, style dumping, and
  the non-closing default flow.
- [ ] 1.4 Add an ignored scratch directory such as `tool/browser-inspect/work/`
  with a tracked placeholder only if needed, and update `.gitignore` so task
  scripts written there are not committed.
- [ ] 1.5 Decide whether the browser profile lives under an ignored
  `tool/browser-inspect/profile/` directory or under an existing cache/temp
  convention, then document and ignore it.

## 2. Playwright Runtime Integration

- [ ] 2.1 Add Playwright as a `tool/` dependency or document the repo-approved
  runtime expectation if the dependency already exists elsewhere.
- [ ] 2.2 Add a narrow `task` entry or tool package script that runs an arbitrary
  scratch script from the workbench without turning the workbench into a
  flag-heavy CLI.
- [ ] 2.3 Ensure helper code works with Bun TypeScript execution and does not
  require application packages to import from `tool/`.
- [ ] 2.4 Add focused tests for pure helper behavior where practical, especially
  selector summary/style serialization shape, while avoiding heavyweight browser
  downloads or headed automation in normal test runs.

## 3. Agent Skill

- [ ] 3.1 Add a new skill under `.agents/skills/` for headed browser
  investigation, with a name that clearly signals URL/selector/style inspection.
- [ ] 3.2 In the skill, define when to use the workbench: user-provided URL plus
  selector/locator/text, Cloudflare or login walls, browser-state-dependent
  inspection, or explicit request for headed browser investigation.
- [ ] 3.3 In the skill, define the script-writing flow: create or update a file
  in `tool/browser-inspect/work/`, import the tracked helpers, write the exact
  Playwright locator code needed for the current investigation, run it, and
  report findings.
- [ ] 3.4 In the skill, require user handoff for verification: when the page is
  blocked by CF/login/captcha, leave the headed browser open and ask the user to
  complete the challenge before resuming.
- [ ] 3.5 In the skill, explicitly prohibit default automatic browser closure;
  close only when the user asks or the current investigation no longer needs the
  window.

## 4. Documentation and Verification

- [ ] 4.1 Update `tool/README.md` with a short pointer to the browser
  investigation workbench.
- [ ] 4.2 Add or update repo convention tests only if existing tooling checks
  require new tool folders, ignored directories, or script entrypoints to be
  registered.
- [ ] 4.3 Run focused formatting and any relevant tool tests after implementation.
- [ ] 4.4 Manually verify one scratch script against a simple public page using
  a CSS selector and one text/locator target; do not require this manual headed
  check in CI.

## Out of scope

- Building a general browser automation product or stable selector-analysis CLI.
- Solving captchas or bypassing anti-bot systems without user participation.
- Running headed Playwright in CI or downloading browsers as part of normal test
  commands.
- Adding app/server/browser inspection behavior outside the repo `tool/`
  workbench.
