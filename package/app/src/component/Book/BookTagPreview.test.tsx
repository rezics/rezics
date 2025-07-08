import { useFixtureInput } from "react-cosmos/client";
import { BookTagView } from "./BookTagPreview";

export default () => {
    const [props] = useFixtureInput<Parameters<typeof BookTagView>[0]>("Props", {
        tagObjects: [
            {
                key: "user-tags",
                name: "用户标签",
                tags: ["奇幻", "冒险", "平行世界", "科幻", "魔法"],
            },
            {
                key: "ai-tags",
                name: "AI 推荐标签",
                tags: ["青春", "成长", "友情", "爱情", "励志"],
            },
            {
                key: "genre-tags",
                name: "类型标签",
                tags: ["小说", "文学", "经典", "畅销书"],
            },
        ],
    });

    return (
        <div className="p-4 max-w-2xl">
            <BookTagView {...props} />
        </div>
    );
};
