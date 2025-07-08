import { useFixtureInput } from "react-cosmos/client";
import { SingleReview } from "./SingleReview";

export default () => {
    const [props] = useFixtureInput<Parameters<typeof SingleReview>[0]>("Props", {
        review: {
            id: "review-1",
            content:
                "这是一本非常精彩的书！故事情节引人入胜，人物塑造生动形象。作者的文笔优美，能够很好地传达情感。特别是主人公的成长历程，让我深深地感动。书中的世界观构建得非常完整，每个细节都经过精心设计。虽然是奇幻题材，但其中探讨的人性、友谊、勇气等主题都很深刻。这本书不仅适合青少年阅读，成年人也能从中获得启发。我会推荐给我的朋友们。",
            rating: 4.5,
            createdAt: "2024-01-15 14:30:00",
            user: {
                id: "user-1",
                name: "张三",
                avatar: "https://i.pravatar.cc/300?img=1",
            },
        },
        handleReply: (reviewId: string) => {
            alert(`Reply to review: ${reviewId}`);
        },
    });

    return (
        <div className="p-4 max-w-2xl">
            <h3 className="mb-4 text-lg font-semibold">单个评论组件</h3>
            <div className="border border-gray-200 rounded-lg p-4">
                <SingleReview {...props} />
            </div>
            <div className="mt-4 space-y-4">
                <div>
                    <h4 className="font-medium mb-2">不同长度的评论</h4>
                    <div className="space-y-4">
                        <div className="border rounded p-2">
                            <SingleReview
                                review={{
                                    id: "review-2",
                                    content: "很好的书！",
                                    rating: 5,
                                    createdAt: "2024-01-14 10:15:00",
                                    user: {
                                        id: "user-2",
                                        name: "李四",
                                        avatar: "https://i.pravatar.cc/300?img=2",
                                    },
                                }}
                                handleReply={props.handleReply}
                            />
                        </div>
                        <div className="border rounded p-2">
                            <SingleReview
                                review={{
                                    id: "review-3",
                                    content: "这本书的故事情节比较一般，但是作者的文笔还是不错的。",
                                    rating: 3,
                                    createdAt: "2024-01-13 16:45:00",
                                    user: {
                                        id: "user-3",
                                        name: "王五",
                                        avatar: "https://i.pravatar.cc/300?img=3",
                                    },
                                }}
                                handleReply={props.handleReply}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
