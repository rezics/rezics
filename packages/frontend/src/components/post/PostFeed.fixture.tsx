"use client";

import { mockPost, mockPostLocked, mockPostLong, mockPostMinimal } from "@/__cosmos__/mock-data";
import React from "react";
import { PostFeed, PostFeedView } from "./PostFeed";

function Canvas({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      {children}
    </div>
  );
}

export default {
  Populated: (
    <Canvas>
      <PostFeedView
        emptyMessage="No posts yet."
        hasMore
        posts={[
          mockPost(),
          mockPostLong(),
          mockPostLocked(),
          mockPostMinimal(),
        ]}
      />
    </Canvas>
  ),

  RealmScoped: (
    <Canvas>
      <PostFeedView
        emptyMessage="No posts yet."
        hasMore={false}
        hideRealm
        posts={[
          mockPost({ unitId: "realm-post-1" }),
          mockPostLong({ unitId: "realm-post-2" }),
          mockPostLocked({ unitId: "realm-post-3" }),
        ]}
      />
    </Canvas>
  ),

  Empty: (
    <Canvas>
      <PostFeedView emptyMessage="No posts yet." hasMore={false} posts={[]} />
    </Canvas>
  ),

  MobileDenseQuery: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <PostFeedView
        emptyMessage="No posts yet."
        hasMore
        posts={[
          mockPostLong({
            unitId: "mobile-long",
            authorUserId: "user-with-a-very-very-long-name",
          }),
          mockPostLocked({ unitId: "mobile-locked" }),
        ]}
      />
    </div>
  ),

  QueryContainerDefault: (
    <Canvas>
      <PostFeed />
    </Canvas>
  ),

  Loading: (
    <Canvas>
      <div className="text-muted-foreground py-8 text-center text-sm">
        The live query container suspends while the API request is pending.
      </div>
    </Canvas>
  ),

  Error: (
    <Canvas>
      <div className="text-destructive py-8 text-center text-sm">
        The live query container renders SectionBoundary error UI when the API fails.
      </div>
    </Canvas>
  ),
};
