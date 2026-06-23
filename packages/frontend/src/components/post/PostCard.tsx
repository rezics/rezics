"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale";
import { LockIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";

// Inferred shape from PostDTO — fields consumed by this card
// 从 PostDTO 推断的字段子集，供卡片消费
interface PostCardPost {
  readonly unitId: string;
  readonly title: string | null;
  readonly summary: string | null;
  readonly authorUserId: string;
  readonly replyCount: number;
  readonly isLocked: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PostCardProps {
  readonly post: PostCardPost;
  /** Hide realm name — used when the card is rendered within a realm detail page
   *  where the context already establishes the realm.
   *  隐藏 realm 名称——用于 realm 详情页内上下文已确立 realm 的场景。 */
  readonly hideRealm?: boolean;
}

// Format a date string as relative time (e.g. "3h ago", "2d ago")
// 将日期字符串格式化为相对时间（如「3h ago」「2d ago」）
function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

/**
 * Mobile (<640px):
 * +--------------------------------------+
 * | Title (truncate 2 lines)             |
 * | summary preview text... (truncate)   |
 * | by author-id · 3h ago   [Replies 5] |
 * +--------------------------------------+
 * w-full, single column card. Title wraps up to 2 lines then
 * truncates. Summary truncates at 2 lines. Meta row flex-wrap.
 *
 * Tablet (640-1023px):
 * +--------------------------------------------+
 * | Title (truncate 2 lines)                   |
 * | summary preview text... (truncate 2 lines) |
 * | by author-id · 3h ago        [Replies 5]  |
 * +--------------------------------------------+
 * Same structure, wider content area.
 *
 * Desktop (1024-1535px):
 * +------------------------------------------------------+
 * | Title (truncate 2 lines)                [Locked]     |
 * | summary preview text... (truncate 2 lines)           |
 * | by author-id · 3h ago                   [Replies 5]  |
 * +------------------------------------------------------+
 * Same structure. Badge row inline with title (flex-wrap).
 *
 * Ultra-wide (>=1536px):
 * +--------------------------------------------------------------+
 * | Title (truncate 2 lines)                       [Locked]     |
 * | summary preview text... (truncate 2 lines)                  |
 * | by author-id · 3h ago                          [Replies 5]  |
 * +--------------------------------------------------------------+
 * Same structure, parent container caps max-w.
 *
 * 单列卡片，无投票列。宽度由父 feed 列约束。
 * 窄端：标题行 flex-wrap，超长标题 2 行截断（line-clamp-2）；
 * 摘要行 line-clamp-2；meta 行 = 作者（truncate）+ 分隔点 + 时间（shrink-0）
 * + 回复计数按钮（shrink-0），justify-between 推开两端。
 * 宽端：内容区 flex-1 吃满卡片余宽，留白落在行尾。
 * 边界：title 为 null -> 显示 "Untitled"。summary 为 null -> 隐藏摘要行。
 * isLocked -> 显示锁定徽章。
 */
export function PostCard({ post, hideRealm: _hideRealm }: PostCardProps) {
  const [t] = useT();

  const displayTitle = post.title ?? "Untitled";
  const isEdited = post.updatedAt !== post.createdAt;

  return (
    <Link className="block focus-visible:outline-2 focus-visible:outline-primary" href={`/post/${post.unitId}`}>
      <Card className="transition-colors hover:bg-accent/50 [--space:--spacing(3)]">
        <CardContent className="flex min-w-0 flex-col gap-1.5">
          {/* Title row / 标题行 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug wrap-anywhere">
              {displayTitle}
            </h3>
            {post.isLocked && (
              <Badge variant="warning">
                <LockIcon /> {t.post.locked}
              </Badge>
            )}
          </div>

          {/* Summary preview / 摘要预览 */}
          {post.summary !== null && (
            <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
              {post.summary}
            </p>
          )}

          {/* Meta row / 元信息行 */}
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="shrink-0">{t.post.by}</span>
              <span className="truncate">{post.authorUserId}</span>
              <span className="shrink-0" aria-hidden>·</span>
              <time className="shrink-0" dateTime={post.createdAt}>
                {formatRelativeTime(post.createdAt)}
              </time>
              {isEdited && (
                <span className="shrink-0 italic">({t.post.edited})</span>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <MessageSquareIcon className="size-3.5" />
              {t.post.replyCount(post.replyCount)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
