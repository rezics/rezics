import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";
import { TextSearchInputBase } from "./TextSearchInputBase";

/**
 * Search input field with a trailing search icon button. Wraps TextSearchInputBase
 * with a flexbox layout that shrinks the button and expands the input to fill
 * available width. On submit or icon click, fires the onSearch callback.
 *
 * 带有尾部搜索图标按钮的搜索输入字段。用 flexbox 布局包装 TextSearchInputBase，
 * 按钮收缩，输入字段展开以填充可用宽度。在提交或点击图标时，触发 onSearch 回调。
 *
 * @layout
 *
 * Mobile <640px (gap-2, flex-1 input):
 * +-----+--+
 * |Input|  |
 * |Area |🔍|
 * +-----+--+
 *
 * Tablet 640–1023px (gap-2, flex-1 input):
 * +----------+--+
 * |Input     |  |
 * |Area      |🔍|
 * +----------+--+
 *
 * Desktop 1024–1535px (gap-2, flex-1 input):
 * +----------+--+
 * |Input     |  |
 * |Area      |🔍|
 * +----------+--+
 *
 * Ultra-wide ≥1536px (gap-2, flex-1 input):
 * +----------+--+
 * |Input     |  |
 * |Area      |🔍|
 * +----------+--+
 */
export const TextSearchInputWithIcon = ({
  onSearch,
  defaultValue,
  placeholder,
}: {
  onSearch: (value: string) => void;
  defaultValue: { keyword: string };
  placeholder?: string;
}) => {
  const { t } = useTranslation(["common"]);
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex items-center gap-2">
      <TextSearchInputBase
        value={value.keyword ?? ""}
        onValueChange={(keyword) => setValue({ keyword })}
        onSubmit={onSearch}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 text-text-brand"
        aria-label={t("common:accessibility_search")}
        onClick={() => onSearch(value.keyword ?? "")}
      >
        <SearchIcon />
      </Button>
    </div>
  );
};
