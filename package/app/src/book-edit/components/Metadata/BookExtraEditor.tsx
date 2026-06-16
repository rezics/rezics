import { RezicsJsonEditor } from "@rezics/ui/editor";
import type React from "react";
import { useEffect, useState } from "react";

/** Book extra data structure. 书籍附加数据结构。 */
export type BookExtraData = {
  [key: string]: unknown;
};

/** Props for BookExtraEditor component. BookExtraEditor 组件的 props。 */
interface BookExtraEditorProps {
  /** Current extra data value. 当前的附加数据值。 */
  value?: BookExtraData | null;
  /** Callback when extra data changes. 附加数据变更时的回调。 */
  onChange?: (value: BookExtraData) => void;
}

/**
 * Book Extra Editor - Editor for book extra metadata.
 * 书籍附加编辑器 —— 用于编辑书籍附加元数据。
 */
export const BookExtraEditor: React.FC<BookExtraEditorProps> = ({
  value,
  onChange,
}) => {
  const [extraData, setExtraData] = useState<BookExtraData>(value || {});

  useEffect(() => {
    setExtraData(value || {});
  }, [value]);

  const handleExtraChange = (newExtraData: BookExtraData) => {
    setExtraData(newExtraData);
    onChange?.(newExtraData);
  };

  return (
    <div className="space-y-4">
      <RezicsJsonEditor
        value={JSON.stringify(extraData, null, 2)}
        onChange={(text) => {
          try {
            handleExtraChange(JSON.parse(text));
          } catch {
            // Invalid JSON — ignore until user fixes it
            // 无效 JSON —— 忽略，等待用户修正
          }
        }}
      />
    </div>
  );
};
