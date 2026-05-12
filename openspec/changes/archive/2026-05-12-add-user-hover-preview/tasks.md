## 1. Component Design

- [x] 1.1 Add a user hover preview composite under `package/app/src/user/components/` that accepts a public user-like data shape and optional sizing/configuration props.
- [x] 1.2 Compose the preview from existing `@rezics/ui/shadcn` primitives, including Popover, Avatar, and Button/Separator/Badge only where appropriate.
- [x] 1.3 Implement avatar and username triggers as profile links, with username hover/focus underline behavior.
- [x] 1.4 Render name, slug, avatar fallback, bio or description, and follower/following counts from supplied data, omitting absent optional fields.
- [x] 1.5 Ensure the preview surface uses rezics token-backed classes and does not edit vendored shadcn primitive source.

## 2. First Consumer Integration

- [x] 2.1 Update `package/app/src/post/components/parts/PostAuthorHeader.tsx` to compose the user hover preview for default and compact sizes.
- [x] 2.2 Preserve parent-card click isolation around nested author identity links.
- [x] 2.3 Keep `PostAuthorHeader` data-driven and verify it does not add `useQuery`, `useMutation`, or profile-fetching hooks.
- [x] 2.4 Render a non-preview anonymous fallback when no usable author user identifier exists.

## 3. Storybook And Documentation

- [x] 3.1 Add Storybook stories for the user hover preview covering default data, missing optional fields, long display data, and compact trigger sizing.
- [x] 3.2 Update `PostAuthorHeader` stories so default and compact states render preview-capable avatar and username affordances.
- [x] 3.3 Add or update app docs references if the new preview component becomes part of the public user feature export.

## 4. Validation

- [x] 4.1 Run focused TypeScript or package validation for touched app files.
- [x] 4.2 Run relevant Storybook or component rendering checks for the preview in light and dark themes.
- [x] 4.3 Run repository searches verifying no new direct `@base-ui/react` imports were added outside `package/ui/src/shadcn/`.
- [x] 4.4 Run repository searches verifying `package/ui/src/shadcn/popover.tsx` was not modified by the implementation.

## 5. Follow Action And Preview Navigation Refinement

- [x] 5.1 Update the change spec to require avatar-plus-follow first-row layout, name/slug below, and profile navigation from avatar, name, and slug.
- [x] 5.2 Add the follow action to the preview content using the existing rezics follow button behavior.
- [x] 5.3 Update preview content links so avatar, name, and slug all navigate to the user's profile route.
- [x] 5.4 Update stories to cover the refined layout and followed-state affordance.
- [x] 5.5 Re-run focused validation for the refined preview implementation.

## 6. Logged-Out Follow Redirect

- [x] 6.1 Update the change spec to require logged-out follow clicks to navigate to login without issuing follow mutations.
- [x] 6.2 Update the shared follow button so follow status queries only run for member sessions.
- [x] 6.3 Update the shared follow button click path so logged-out viewers navigate to `/login`.
- [x] 6.4 Re-run focused validation for follow button and hover preview behavior.
