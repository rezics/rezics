"use client";

import { mockPost, mockPostLocked, mockPostLong, mockPostMinimal } from "@/__cosmos__/mock-data";
import { BookReviewListView } from "./review/page";

const reviews = [
  mockPostLong({
    unitId: "review-long",
    replyCount: 128,
  }),
  mockPostLocked({
    unitId: "review-locked",
    title: "Moderator-locked review after author attribution dispute",
  }),
  mockPostMinimal({
    unitId: "review-minimal",
  }),
  ...Array.from({ length: 22 }, (_, index) =>
    mockPost({
      unitId: `review-${index}`,
      title: `Review ${index + 1}`,
      summary: index % 3 === 0 ? null : `Short review summary ${index + 1}`,
      replyCount: index,
    })
  ),
];

export default {
  Empty: (
    <div className="p-4">
      <BookReviewListView items={[]} offset={0} onLoadMore={() => {}} total={0} />
    </div>
  ),
  MobileLongAndMinimal: (
    <div className="w-[320px] p-4">
      <BookReviewListView items={reviews.slice(0, 3)} offset={0} onLoadMore={() => {}} total={3} />
    </div>
  ),
  HasMore: (
    <div className="p-4">
      <BookReviewListView items={reviews} offset={0} onLoadMore={() => {}} total={60} />
    </div>
  ),
};
