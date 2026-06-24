"use client";

import { mockPost, mockPostLong, mockPostLocked, mockPostMinimal } from "@/__cosmos__/mock-data";
import { PagedList } from "./PagedList";

const fiveItems = [
  mockPost(),
  mockPostLong(),
  mockPostLocked(),
  mockPostMinimal(),
  mockPost({ unitId: "post-005", title: "Drizzle ORM 与 Effect Schema 的类型安全集成" }),
];

const oneItem = [mockPost()];

function renderPost(post: { unitId: string; title: string | null }) {
  return (
    <div key={post.unitId} className="px-4 py-3">
      <span className="text-sm">{post.title ?? "(no title)"}</span>
    </div>
  );
}

export default {
  WithItems: (
    <PagedList
      emptyMessage="No posts found."
      hasMore={false}
      items={fiveItems}
      onLoadMore={() => {}}
      renderItem={renderPost}
    />
  ),
  Empty: (
    <PagedList
      hasMore={false}
      items={[]}
      onLoadMore={() => {}}
      renderItem={renderPost}
    />
  ),
  HasMore: (
    <PagedList
      hasMore={true}
      items={fiveItems}
      onLoadMore={() => {}}
      renderItem={renderPost}
    />
  ),
  CustomEmptyMessage: (
    <PagedList
      emptyMessage="暂时还没有内容，快来发布第一篇吧！"
      hasMore={false}
      items={[]}
      onLoadMore={() => {}}
      renderItem={renderPost}
    />
  ),
  SingleItem: (
    <PagedList
      hasMore={false}
      items={oneItem}
      onLoadMore={() => {}}
      renderItem={renderPost}
    />
  ),
};
