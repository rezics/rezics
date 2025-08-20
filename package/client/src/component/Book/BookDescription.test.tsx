import { useFixtureInput } from "react-cosmos/client";
import { BookDescription } from "./BookDescription.tsx";

export default () => {
    const [props] = useFixtureInput<BookDescription.Show>("Props", {
        description: `《哈利·波特与魔法石》是英国作家J.K.罗琳创作的长篇小说，《哈利·波特》系列小说的第一部。

该作的主人公是哈利·波特，一个巫师，他在霍格沃茨魔法学校的六年学习生活中的冒险故事。该故事的主线是哈利与伏地魔的对抗，伏地魔是一个邪恶的魔法师，他杀死了哈利的父母。

这本书不仅是一部儿童文学作品，更是一部关于成长、友谊、勇气和爱的深刻故事。它创造了一个完整的魔法世界，包含了霍格沃茨魔法学校、对角巷、九又四分之三站台等经典场景。

作品中的人物塑造鲜明，哈利·波特、赫敏·格兰杰、罗恩·韦斯莱等主要角色都有着独特的个性和成长轨迹。这本书自1997年出版以来，已经被翻译成多种语言，在全世界范围内都获得了巨大的成功。`,
    });

    return (
        <div className="p-4 max-w-2xl">
            <h3 className="mb-4 text-lg font-semibold">书籍描述组件</h3>
            <div className="border border-gray-200 rounded-lg p-4">
                <BookDescription.Show {...props} />
            </div>
            <div className="mt-4 space-y-4">
                <div>
                    <h4 className="font-medium mb-2">不同长度的描述</h4>
                    <div className="space-y-2">
                        <div className="border rounded p-2">
                            <BookDescription.Show description="这是一本精彩的小说。" />
                        </div>
                        <div className="border rounded p-2">
                            <BookDescription.Show description="这是一本关于魔法世界的奇幻小说，讲述了一个年轻巫师的成长故事。作品充满了想象力和创意，深受读者喜爱。" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
