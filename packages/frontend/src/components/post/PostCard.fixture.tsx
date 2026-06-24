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
    <div className="p-4 max-w-2xl">
      <PostCard post={mockPost()} />
    </div>
  ),

  LongTitle: (
    <div className="p-4 max-w-2xl">
      <PostCard post={mockPostLong()} />
    </div>
  ),

  Locked: (
    <div className="p-4 max-w-2xl">
      <PostCard post={mockPostLocked()} />
    </div>
  ),

  Minimal: (
    <div className="p-4 max-w-2xl">
      <PostCard post={mockPostMinimal()} />
    </div>
  ),

  Edited: (
    <div className="p-4 max-w-2xl">
      <PostCard
        post={mockPost({
          unitId: "post-edited",
          updatedAt: "2025-06-20T10:00:00.000Z",
        })}
      />
    </div>
  ),

  WithHideRealm: (
    <div className="p-4 max-w-2xl">
      <PostCard post={mockPost()} hideRealm />
    </div>
  ),
};
