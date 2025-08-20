import { useFixtureInput } from "react-cosmos/client";
import { BookTagView } from "./BookTagPreview";

export default function BookTagViewTest() {
    const [props] = useFixtureInput<
        Parameters<typeof BookTagView.Container>[0]
    >("Props", {
        tagObjects: [
            {
                key: "user-tags",
                name: "用户标签",
                tags: ["奇幻", "冒险", "青春", "成长"],
            },
            {
                key: "ai-tags",
                name: "AI推荐标签",
                tags: ["友谊", "勇气", "魔法", "英雄"],
            },
            {
                key: "genre-tags",
                name: "类型标签",
                tags: ["小说", "奇幻文学", "青少年读物"],
            },
        ],
    });

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <BookTagView.Container {...props} />
        </div>
    );
}
