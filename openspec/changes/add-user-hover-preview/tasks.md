## 1. Component Design

- [ ] 1.1 Add a user hover preview composite under `package/app/src/user/components/` that accepts a public user-like data shape and optional sizing/configuration props.
- [ ] 1.2 Compose the preview from existing `@rezics/ui/shadcn` primitives, including Popover, Avatar, and Button/Separator/Badge only where appropriate.
- [ ] 1.3 Implement avatar and username triggers as profile links, with username hover/focus underline behavior.
- [ ] 1.4 Render name, slug, avatar fallback, bio or description, and follower/following counts from supplied data, omitting absent optional fields.
- [ ] 1.5 Ensure the preview surface uses rezics token-backed classes and does not edit vendored shadcn primitive source.

## 2. First Consumer Integration

- [ ] 2.1 Update `package/app/src/post/components/parts/PostAuthorHeader.tsx` to compose the user hover preview for default and compact sizes.
- [ ] 2.2 Preserve parent-card click isolation around nested author identity links.
- [ ] 2.3 Keep `PostAuthorHeader` data-driven and verify it does not add `useQuery`, `useMutation`, or profile-fetching hooks.
- [ ] 2.4 Render a non-preview anonymous fallback when no usable author user identifier exists.

## 3. Storybook And Documentation

- [ ] 3.1 Add Storybook stories for the user hover preview covering default data, missing optional fields, long display data, and compact trigger sizing.
- [ ] 3.2 Update `PostAuthorHeader` stories so default and compact states render preview-capable avatar and username affordances.
- [ ] 3.3 Add or update app docs references if the new preview component becomes part of the public user feature export.

## 4. Validation

- [ ] 4.1 Run focused TypeScript or package validation for touched app files.
- [ ] 4.2 Run relevant Storybook or component rendering checks for the preview in light and dark themes.
- [ ] 4.3 Run repository searches verifying no new direct `@base-ui/react` imports were added outside `package/ui/src/shadcn/`.
- [ ] 4.4 Run repository searches verifying `package/ui/src/shadcn/popover.tsx` was not modified by the implementation.
