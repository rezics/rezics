"use client";
import {
  mockPost,
  mockPostLocked,
  mockPostLong,
  mockPostMinimal,
} from "@/__cosmos__/mock-data";
import { PostCard } from "./PostCard";

export default {
  Default: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PostCard post={mockPost()} />
    </div>
  ),

  LongTitle: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PostCard post={mockPostLong()} />
    </div>
  ),

  Locked: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PostCard post={mockPostLocked()} />
    </div>
  ),

  Minimal: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PostCard post={mockPostMinimal()} />
    </div>
  ),

  Edited: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PostCard
        post={mockPost({
          unitId: "post-edited",
          updatedAt: "2025-06-20T10:00:00.000Z",
        })}
      />
    </div>
  ),

  WithHideRealm: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PostCard post={mockPost()} hideRealm />
    </div>
  ),

  MobileDense: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <div className="flex flex-col gap-2">
        <PostCard post={mockPost()} />
        <PostCard post={mockPostLong()} />
        <PostCard post={mockPostLocked()} />
      </div>
    </div>
  ),

  OverflowMeta: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <PostCard
        post={mockPost({
          unitId: "post-overflow-meta",
          authorUserId:
            "user-with-a-very-very-very-long-stable-identifier-that-should-truncate",
          replyCount: 1234567,
          title:
            "A title with a singleunbrokenidentifierthatshouldwrapanywherewithoutforcinghorizontaloverflow",
          summary:
            "A summary containing another singleunbrokenidentifierthatkeepsgoingandgoingandgoing so the card can prove its wrapping rules inside a 320px container.",
        })}
      />
    </div>
  ),
};
