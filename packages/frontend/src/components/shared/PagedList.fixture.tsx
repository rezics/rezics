"use client";

import { mockPost, mockPostLong, mockPostLocked, mockPostMinimal } from "@/__cosmos__/mock-data";
import { useState } from "react";
import { PagedList } from "./PagedList";

const fiveItems = [
  mockPost(),
  mockPostLong(),
  mockPostLocked(),
  mockPostMinimal(),
  mockPost({ unitId: "post-005", title: "Drizzle ORM 与 Effect Schema 的类型安全集成" }),
];

const oneItem = [mockPost()];
const longItems = [
  mockPostLong({
    unitId: "post-overflow-1",
    title:
      "Singleunbrokenidentifierthatshouldnotforcehorizontaloverflowinsidepagedlistrows",
  }),
  mockPost({
    unitId: "post-overflow-2",
    title:
      "A compact row with mixed English and 中文标题 plus 1234567890 to exercise dense wrapping.",
  }),
];

function renderPost(post: { unitId: string; title: string | null }) {
  return (
    <div key={post.unitId} className="px-4 py-3">
      <span className="text-sm">{post.title ?? "(no title)"}</span>
    </div>
  );
}

function StatefulLoadMore() {
  const [count, setCount] = useState(2);
  const visibleItems = fiveItems.slice(0, count);

  return (
    <PagedList
      emptyMessage="No posts found."
      hasMore={count < fiveItems.length}
      items={visibleItems}
      onLoadMore={() => setCount((prev) => Math.min(prev + 2, fiveItems.length))}
      renderItem={renderPost}
    />
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
  StatefulLoadMore: <StatefulLoadMore />,
  MobileDense: (
    <div className="mx-auto w-full max-w-[320px]">
      <PagedList
        hasMore={true}
        items={fiveItems}
        onLoadMore={() => {}}
        renderItem={renderPost}
      />
    </div>
  ),
  LongRows: (
    <div className="mx-auto w-full max-w-[320px]">
      <PagedList
        hasMore={false}
        items={longItems}
        onLoadMore={() => {}}
        renderItem={renderPost}
      />
    </div>
  ),
};
