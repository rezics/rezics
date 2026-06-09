import type { CommentListContext } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";
import {
  COMMENT_CONTEXT_ALL_OPTION_VALUE,
  commentContextFromOptionValue,
  commentContextToOptionValue,
} from "../../models/commentContext";

export interface CommentContextRealmOption {
  realmUnitId: string;
  /**
   * Resolved realm title; the raw unit id is the fallback while titles
   * load (or when a realm read fails).
   * 已解析的 realm 标题；标题加载中（或 realm 读取失败）时回退为原始
   * unit id。
   */
  title?: string | null;
}

interface CommentContextSelectProps {
  value: CommentListContext;
  realmOptions: readonly CommentContextRealmOption[];
  onChange: (context: CommentListContext) => void;
}

/**
 * Read/write context selector for a comment thread: All plus the root
 * unit's realms. The `direct` context is deliberately absent — it is an
 * API/test context, not a user-facing mode.
 * 评论线程的读/写语境选择器：“全部”加上根 Unit 的各 realm。`direct`
 * 语境刻意缺席——它是 API/测试语境，不是面向用户的模式。
 */
export const CommentContextSelect: React.FC<CommentContextSelectProps> = ({
  value,
  realmOptions,
  onChange,
}) => {
  const { t } = useTranslation(["community"]);

  return (
    <Select
      value={commentContextToOptionValue(value)}
      onValueChange={(next) => onChange(commentContextFromOptionValue(next))}
    >
      <SelectTrigger
        className="w-full sm:w-52"
        aria-label={t("community:comment_context_label")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t("community:comment_context_label")}</SelectLabel>
          <SelectItem value={COMMENT_CONTEXT_ALL_OPTION_VALUE}>
            {t("community:comment_context_all")}
          </SelectItem>
          {realmOptions.map((option) => (
            <SelectItem key={option.realmUnitId} value={option.realmUnitId}>
              {option.title ?? option.realmUnitId}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
