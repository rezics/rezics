import { useFixtureInput } from "react-cosmos/client";
import { SingleReviewContainer } from "./SingleReview";

export default function SingleReviewTest() {
  const [reviewProps] = useFixtureInput<
    Parameters<typeof SingleReviewContainer>[0]
  >("Review Props", {
    review: {
      unitId: "review-1",
      bookId: "book-1",
      user: {
        unitId: "user-1",
        name: "张三",
        avatar: "https://via.placeholder.com/40",
        followersCount: 1232,
      },
      content:
        "这本书很不错，值得推荐。情节紧凑，人物形象鲜明。作者的文笔很好，读起来很流畅。特别是对于主角的心理描写，非常细腻。",
      rating: 4.5,
      created_at: "2024-01-15",
    },
    handleReply: (reviewId: string) => {
      console.log("Reply to review:", reviewId);
    },
  });

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <SingleReviewContainer {...reviewProps} />
    </div>
  );
}
