import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
import { HomeSectionShell } from "./HomeSectionShell";

type Book = BookDTO;

export type HomeRankingSectionProps = {
  title?: string;
  limit?: number;
};

/**
 * 首页排行榜部分
 *
 * 展示最近更新的图书排行榜（按 updatedAt 倒序，取前 N 个）。列表项包含书籍封面缩略图、
 * 排名序号、标题和作者名。加载中显示 spinner，错误时显示错误提示。
 *
 * 响应式设计（单一列表布局，无断点差异）
 *
 * 标准布局（所有尺寸统一）:
 * ┌──────────────────────────────────┐
 * │ 排行榜        [spinner if loading] │ 标题 text-base font-semibold
 * │ ────────────────────────────────  │ mb-3
 * │ [img] # 图书标题                   │ 列表项 py-2 gap-3
 * │       作者名                       │ 头像 rounded-md, 排序 w-8 text-right
 * │ [img] # 图书标题                   │ 描述 text-xs text-text-secondary
 * │       作者名                       │ 标题 truncate with title attribute
 * │ [img] # 图书标题                   │
 * │       作者名                       │
 * └──────────────────────────────────┘
 *
 * 加载状态:
 * ┌──────────────────────────────────┐
 * │ 排行榜                    [spinner] │
 * │ ────────────────────────────────  │
 * │ (列表项逐个加载中)                 │
 * └──────────────────────────────────┘
 *
 * 错误状态:
 * ┌──────────────────────────────────┐
 * │ 排行榜                             │
 * │ ────────────────────────────────  │
 * │ [错误提示信息]                     │ QueryErrorDisplay component
 * └──────────────────────────────────┘
 *
 * 窄屏处理：标题和作者使用 truncate，超出内容用省略号；排序数字右对齐 w-8；
 * 宽屏处理：列表项间距均匀分布，头像固定大小不缩放。
 */
export const HomeRankingSection: React.FC<HomeRankingSectionProps> = ({
  title,
  limit = 10,
}) => {
  const { t } = useTranslation(["page"]);
  const resolvedTitle = title ?? t("page:home_sections_ranking");

  const { data, isLoading, error } = useQuery(
    bookQueries.list({
      start: 0,
      limit,
      sort: { type: "updatedAt", order: "desc" },
    }),
  );

  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  return (
    <HomeSectionShell title={resolvedTitle} isLoading={isLoading} error={error}>
      <ul className="list-none m-0 p-0">
        {books.map((book, idx) => {
          const title = getBookTitle(book);
          const coverUrl = getBookCoverUrl(book);
          const authorName = getBookAuthorName(book);
          return (
            <li key={book.unitId} className="py-2 flex items-center gap-3">
              <Avatar className="rounded-md">
                {coverUrl && <AvatarImage src={coverUrl} alt={title} />}
                <AvatarFallback>{idx + 1}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {idx + 1}
                  </span>
                  <span className="truncate" title={title}>
                    {title}
                  </span>
                </div>
                <div className="text-xs text-text-secondary truncate pl-10">
                  {authorName}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </HomeSectionShell>
  );
};
