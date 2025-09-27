import { useFixtureInput } from "react-cosmos/client";
import { QuoteExcerptPreview } from "./QuoteExcerptPreview";

export default () => {
  const [props] = useFixtureInput<QuoteExcerptPreview.Container>("Props", {
    id: "book-123",
  });

  return (
    <div className="p-4 max-w-2xl">
      <h3 className="mb-4 text-lg font-semibold">摘录预览组件</h3>
      <div className="border border-gray-200 rounded-lg p-4">
        <QuoteExcerptPreview.Container {...props} />
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          注意：此组件需要 GraphQL 查询支持，在 Cosmos 中可能显示加载状态或错误信息。
        </p>
      </div>
    </div>
  );
};
