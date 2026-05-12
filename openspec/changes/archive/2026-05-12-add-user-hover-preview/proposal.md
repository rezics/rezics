## Why

User-authored surfaces currently render avatar and display name as small, disconnected elements. Readers have to navigate away to understand who a person is, and the display name does not consistently advertise itself as a profile link on hover.

This change adds a consistent profile preview interaction for user identity affordances while keeping the UI aligned with rezics' shadcn-first component policy and quiet surface treatment.

## Problem

Author headers and user references are repeated across post, review, remark, excerpt, and profile-adjacent surfaces. The current behavior lacks a reusable hover/focus preview and some username text is not styled like an interactive link.

## Goals

- Show a compact profile preview when hovering or focusing a user's avatar or username.
- Render username text with link-style hover underlining.
- Use `@rezics/ui/shadcn` Popover, Avatar, Button, and related shadcn theme components wherever they fit.
- Keep presentation components pure by rendering from user data already supplied by the owning surface.
- Follow rezics design tokens and the depth-without-shadow pattern for the floating surface.

## Non-goals

- Do not redesign full profile pages or profile tabs.
- Do not add a new third-party UI library.
- Do not edit vendored shadcn primitives under `package/ui/src/shadcn/` unless an existing project exception already permits it.
- Do not introduce backward-compatible aliases or duplicate legacy user identity components.
- Do not require lazy data fetching in post/review/remark/excerpt presentation atoms.

## Scope

The initial scope is the app-side user identity affordance used by `PostAuthorHeader`, with follow-up-ready composition for other user references that already receive a `PublicUser` or `UserDTO` shape.

## What Changes

- Add a reusable user hover preview component for app-side user identity references.
- Make avatar and username act as preview triggers and profile links.
- Make username hover render a URL-style underline.
- Render the popover content with shadcn/base Popover composition and rezics-aligned tokens.
- Add Storybook coverage for default, compact, missing optional profile fields, and long display-name states.
- Update the first consumer, `PostAuthorHeader`, to compose the new identity preview without owning fetch or mutation state.

## Capabilities

### New Capabilities

- `user-hover-preview`: Defines profile-preview behavior for avatar and username affordances, including trigger semantics, content requirements, styling constraints, and data ownership.

### Modified Capabilities

- None.

## Impact

- Affected packages: `package/app`, `package/ui`.
- Likely app files: `package/app/src/user/components/`, `package/app/src/post/components/parts/PostAuthorHeader.tsx`, related Storybook stories and docs.
- UI primitives: consume existing `@rezics/ui/shadcn` Popover, Avatar, Button, and Separator/Badge where appropriate.
- APIs: no new backend endpoint is required for the initial implementation because existing `PublicUser` / `UserDTO` data contains the fields needed for a useful preview. Missing optional fields are rendered gracefully.
- Dependencies: no new dependency is expected.
- Backward compatibility: internal development-stage cutover; replace the current inline avatar/name composition in touched consumers rather than adding compatibility wrappers.
