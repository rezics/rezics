import { useFixtureInput } from "react-cosmos/client";
import {
  SingleExcerptShow,
  type SingleExcerptShowProps,
} from "./SingleExcerpt";

export default function SingleExcerptTest() {
  const [props] = useFixtureInput<SingleExcerptShowProps>("Props", {
    author: {
      unitId: "user-1",
      name: "张三",
      avatar: "https://i.pravatar.cc/300?img=1",
    },
    content:
      "生活就像一盒巧克力，你永远不知道下一颗是什么味道。这句话告诉我们，生活充满了未知和惊喜，我们应该以开放的心态去迎接每一个新的挑战。",
    stats: {
      replies: 23,
      likes: 156,
      date: "2024-01-15 14:30:00",
    },
    source: "引自第 42 页",
    originalLink: "#",
  });

  return (
    <div className="p-4 max-w-2xl">
      <h3 className="mb-4 text-lg font-semibold">单个摘录组件</h3>
      <div className="space-y-4">
        <SingleExcerptShow {...props} />

        <div>
          <h4 className="font-medium mb-2">不同类型的摘录</h4>
          <div className="space-y-4">
            <SingleExcerptShow
              author={{
                unitId: "user-2",
                name: "李四",
                avatar: "https://i.pravatar.cc/300?img=2",
              }}
              content="知识就是力量。"
              stats={{
                replies: 5,
                likes: 42,
                date: "2024-01-14 10:15:00",
              }}
              source="引自第 1 页"
              originalLink="#"
            />

            <SingleExcerptShow
              author={{
                unitId: "user-3",
                name: "王五",
                avatar: "https://i.pravatar.cc/300?img=3",
              }}
              content="每个人心中都有一团火，路过的人只看到烟。但是总有一个人，总有那么一个人能看到这团火，然后走过来，陪我一起。"
              stats={{
                replies: 87,
                likes: 234,
                date: "2024-01-13 16:45:00",
              }}
              source="引自第 127 页"
              originalLink="#"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
