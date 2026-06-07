---
title: Home feed card layout
status: done
created: 2026-06-07
completed: 2026-06-07
supersededBy:
tags: [app, feed, home, ui]
---

## Why

The home page feed should read as a lower-priority stream at the bottom of the
homepage, not as an early interruption between home discovery sections. It also
needs to use the feed stream width wrapper so feed rows keep the same reading
measure as realm feeds.

Feed preview cards need their own presentation. `PostCard` is a post/detail
surface and currently brings list-row borders plus collapsible body behavior
through `PostBodyMarkdown`. `PostFlowCard` already has much of the desired
preview shape, but the durable concept is a `FeedCard`: one plain, interactive
card that truncates content and opens the target row instead of expanding in
place.

## Durable constraints & decisions

- `(comment)` Feed previews are not post/detail cards. The feed layer owns the
  preview shell so row navigation, truncation, and hover treatment stay separate
  from full post/review surfaces.
- `(test)` Feed card body previews truncate without rendering expand/collapse
  controls. Clicking the card opens the row target; nested controls must not
  accidentally trigger parent navigation.
- `(type)` `FeedCard` should carry generic feed-preview props rather than
  post-specific names: content post, optional title, optional target/context
  metadata, optional media slot, reaction configuration, and open/reply handlers.
- `(comment)` `PostFlowCard` and `PostFlowMediaCard` are replaced by `FeedCard`
  semantics. Do not keep a parallel post-flow card vocabulary once the feed card
  exists.
- `(test)` Review and non-review feed rows both render through feed card
  semantics: one card surface, no row divider, body truncation, and preserved
  reaction/reply affordances.
- `(comment)` Hover treatment should feel like a plain content card with
  interactive lift/state, not a heavy recommendation card. Keep the card in the
  feed stream rather than turning the whole section into an elevated panel.

## 1. Feed Card

- [x] 1.1 Add `package/app/src/feed/components/FeedCard.tsx` by moving the
  reusable preview behavior from `PostFlowCard` into the feed feature and
  renaming the API around feed-preview semantics.
- [x] 1.2 Use pure CSS line clamping inside `FeedCard` with `MarkdownContent`,
  not `PostBodyMarkdown`/`Collapsible`.
- [x] 1.3 Support text-first and media-forward layouts through `FeedCard` props
  or a small feed-local variant, without retaining `PostFlowCard` naming.
- [x] 1.4 Export `FeedCard` from `package/app/src/feed/index.ts`.

## 2. Feed Rows

- [x] 2.1 Update `package/app/src/feed/components/FeedContentCard.tsx` so
  content rows render through `FeedCard` instead of `PostCard`/row-wrapper
  `ReviewCard`.
- [x] 2.2 Preserve feed row navigation through `row.href`, reply focus behavior,
  `summaryScopeKey`, `reactionScopeKey`, `variantContext`, and realm moderation
  affordances where applicable.
- [x] 2.3 Keep review-specific data such as rating and target unit visible in the
  feed card without bringing back the bordered `ReviewCard` row shell.
- [x] 2.4 Update `FeedRenderer` spacing/stories if needed so mixed content rows
  show card separation rather than border-divider separation.

## 3. Home Layout

- [x] 3.1 Move the home `FeedSection` in
  `package/app/src/home/pages/Home.tsx` to the bottom of the homepage section
  stack.
- [x] 3.2 Wrap the home feed in `FeedLayout`, matching the existing realm feed
  stream measure.
- [x] 3.3 Keep the existing home feed query shape unless implementation reveals
  a clear need to change `scope`, `sort`, or `limit`.

## 4. Replace PostFlow Card Vocabulary

- [x] 4.1 Remove or rename `package/app/src/components/card/flow/PostFlowCard.tsx`
  and `PostFlowMediaCard.tsx` so exports no longer advertise post-flow cards as
  a separate surface.
- [x] 4.2 Update `package/app/src/components/card/index.ts` and
  `package/app/src/components/card/flow/index.ts` callsites/exports to point to
  feed card semantics or remove obsolete exports.
- [x] 4.3 Replace `PostFlowCard` Storybook/docs entries with `FeedCard`
  examples that cover default content, review content, media content, long body
  truncation, and mixed feed rows.

## 5. Verification

- [x] 5.1 Run focused tests or type checks for the touched app package.
- [x] 5.2 Run `bun run check:convention` if component exports, links, or UI
  conventions changed.
- [x] 5.3 Provide the exact home and Storybook URLs for human visual review
  rather than running heavyweight browser automation by default.

## Out of scope

- Changing feed ranking, pagination, or backend feed contracts.
- Redesigning carousel rows or shelf/work carousel cards.
- Changing post detail pages, review detail pages, comment thread cards, or the
  `PostBodyMarkdown` collapsible behavior outside feed previews.
- Adding new browser automation or downloading browsers unless explicitly
  requested.
