"use client";

import { mockPost, mockPostLocked, mockPostLong, mockPostMinimal } from "@/__cosmos__/mock-data";
import { BookDiscussionListView } from "./discussion/page";

const posts = [
  mockPost(),
  mockPostLong(),
  mockPostLocked(),
  mockPostMinimal(),
  ...Array.from({ length: 24 }, (_, index) =>
    mockPost({
      unitId: `discussion-${index}`,
      title: `Discussion thread ${index + 1}`,
      replyCount: index * 2,
    })
  ),
];

export default {
  Empty: (
    <div className="p-4">
      <BookDiscussionListView items={[]} offset={0} onLoadMore={() => {}} total={0} />
    </div>
  ),
  LongAndLocked: (
    <div className="w-[320px] p-4">
      <BookDiscussionListView items={posts.slice(0, 4)} offset={0} onLoadMore={() => {}} total={4} />
    </div>
  ),
  HasMore: (
    <div className="p-4">
      <BookDiscussionListView items={posts} offset={0} onLoadMore={() => {}} total={80} />
    </div>
  ),
};
