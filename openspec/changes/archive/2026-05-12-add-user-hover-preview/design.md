## Context

`PostAuthorHeader` currently composes a linked avatar and a plain text author name. Similar avatar/name patterns appear across excerpt, review, remark, profile, and list surfaces. The codebase already has the required primitive set in `@rezics/ui/shadcn`: `Popover`, `Avatar`, `Button`, `Separator`, and related base-luma components. The shadcn project context confirms this package is Vite, non-RSC, Tailwind v4/UnoCSS-compatible, `base-luma`, and Base UI-backed.

The requested behavior matches shadcn's Base UI Popover direction rather than a custom tooltip: the surface can hold rich profile content and may include actions such as following. The upstream docs entry is `https://ui.shadcn.com/docs/components/base/popover`, with Base UI API details at `https://base-ui.com/react/components/popover.md`.

Relevant local constraints:

- `ui-component-foundation` requires shadcn primitives from `@rezics/ui/shadcn` first.
- Vendored shadcn primitives under `package/ui/src/shadcn/` are Path P and should not be edited for this change.
- `post-presentation-architecture` keeps post/review/remark/excerpt presentation atoms free of data fetching and mutation ownership.
- rezics design favors `bg-surface-elevated` plus a whisper border for popovers; shadow-heavy card treatment is not appropriate.

## Goals / Non-Goals

**Goals:**

- Provide one reusable app-side user identity preview for avatar/name affordances.
- Use shadcn Base UI Popover composition for the floating surface.
- Preserve profile navigation from avatar and username.
- Render username text with hover/focus underline.
- Keep the first consumer, `PostAuthorHeader`, pure and data-driven.
- Cover default, compact, missing optional data, and long-name states in Storybook.

**Non-Goals:**

- No profile page redesign.
- No backend or contract changes.
- No new dependency.
- No lazy user fetching in post-kind presentation components.
- No edits to `package/ui/src/shadcn/popover.tsx` or other vendored shadcn primitives.

## Decisions

### Decision 1: Build a feature-level composite, not a new shadcn primitive

Create a rezics-authored composite in the app user feature, for example `package/app/src/user/components/UserHoverPreview.tsx` or a similarly named component. It should consume shadcn primitives from `@rezics/ui/shadcn` and profile links from the app's existing router link primitives.

Rationale: the behavior is domain-specific because it knows about `PublicUser` / `UserDTO`, profile routes, bio text, counts, and optional follow actions. Adding it under `package/ui/src/shadcn/` would violate the vendored primitive boundary.

Alternatives considered:

- Modify `@rezics/ui/shadcn/popover`: rejected because the shadcn primitive is already installed and should remain vendored.
- Add a generic `HoverCard` primitive: rejected for the first pass because shadcn Popover already fits the user's requested component family and the domain composite has a concrete consumer.

### Decision 2: Use shadcn Popover with two profile-link triggers

Render a single `Popover` with separate `PopoverTrigger` elements for avatar and username. Each trigger uses Base UI's `render` composition so the visible trigger remains a router link. Configure hover opening on the triggers, and keep click behavior as profile navigation.

Target structure:

```tsx
<Popover>
  <PopoverTrigger openOnHover render={<Link to="/user/$userId" ... />}>
    <Avatar>...</Avatar>
  </PopoverTrigger>
  <PopoverTrigger openOnHover render={<TextLink underline="hover" ... />}>
    {displayName}
  </PopoverTrigger>
  <PopoverContent side="bottom" align="start">...</PopoverContent>
</Popover>
```

Rationale: both visual affordances should preview the same user, and the username underline should come from the link component or equivalent link styling rather than a bespoke CSS rule.

Alternatives considered:

- Wrap avatar and name in one large trigger: rejected because username underline and avatar hit target need different visual treatment.
- Use Tooltip: rejected because the preview is rich content, not a short label.

### Decision 3: Render from supplied user data in the initial implementation

The component accepts a public user-like object with `userId`, `slug`, `name`, `avatar`, `bio`, `description`, `followersCount`, and `followingsCount`. It derives display fields and omits unavailable optional sections.

Rationale: `PostDTO.author` and `UnitDTO.user` already use `PublicUser`, and profile pages use `UserDTO`. This covers the requested hover preview without introducing data ownership into presentation atoms.

Alternatives considered:

- Fetch `/user/brief/:userId` when the popover opens: deferred. The brief endpoint lacks follower counts, and adding queries inside post presentation components would conflict with current feature layering.
- Add a new profile-preview API endpoint: not needed for the initial scope.

### Decision 4: Keep follow actions optional and outside presentation fetch ownership

The preview may render the existing `FollowButton` only when the caller supplies enough context and the composition does not make a post-kind presentation atom own mutations. If this creates layering friction, omit the follow action in the first integration and keep the card informational.

Rationale: screenshots show follow/join actions, but the safest first cut is the identity preview itself. Follow behavior can be wired by surfaces that already own authenticated interaction state.

Alternatives considered:

- Always include `FollowButton`: rejected because it may pull mutation/auth behavior into otherwise pure item components.

### Decision 5: Use rezics surface tokens and shadcn theme slots

Popover content should rely on shadcn Popover defaults where sufficient. Any app-level class additions should stay token-based: `bg-surface-elevated`, `text-text-primary`, `text-text-secondary`, `border-border-whisper`, `rounded-md`/`rounded-lg`, and restrained spacing. Avoid raw hex values, decorative gradients, and large shadows.

Rationale: rezics popovers are elevated surfaces with hairline boundaries. The preview should feel like a quiet reading/product surface, not a copied social-media chrome.

Alternatives considered:

- Dark X-style card: rejected because it clashes with the parchment/warm stone design language.
- Reddit-style cover banner: deferred; useful only if user profiles gain a first-class banner image field.

## Data Flow

```text
PostDTO.author / UnitDTO.user / UserDTO
          │
          ▼
User hover preview composite
          │
          ├─ avatar trigger: Link + Avatar
          ├─ username trigger: TextLink underline=hover
          └─ PopoverContent: profile summary from supplied fields
```

No backend call is required in the initial flow.

## Risks / Trade-offs

- Hover-only interactions can be inaccessible on touch devices -> The profile link remains the primary action; hover preview is progressive enhancement, and focus should open it for keyboard users.
- Rich popovers can conflict with card click handlers -> Consumers such as `PostAuthorHeader` should continue stopping parent card clicks around nested identity affordances.
- Long usernames or bios can overflow compact cards -> The preview and trigger must use truncation/line clamps with stable dimensions.
- Adding follow actions may blur presentation boundaries -> Treat follow as optional and wire it only from appropriate owning surfaces.
- Multiple triggers can create hover-close flicker -> Use shared `Popover` content and appropriate side offsets/close delay supported by Base UI Popover.

## Rollout Plan

1. Add the user hover preview composite and stories.
2. Update `PostAuthorHeader` to use it for default and compact author identity.
3. Verify Storybook states in light and dark modes.
4. Run focused type/lint/test checks for touched app and UI packages.
5. Expand to excerpt/review/remark/user-list call sites in separate follow-up work if the first integration lands cleanly.

## Open Questions

- Should the first implementation include `FollowButton` in `PostAuthorHeader` previews, or keep the first pass informational only?
- Should `/u/$userSlug` be preferred when a slug exists, or should `/user/$userId` remain the canonical app route for the first integration?
