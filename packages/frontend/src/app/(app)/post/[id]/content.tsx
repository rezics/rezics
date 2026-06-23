"use client";

import { postQuery } from "@/atoms/posts";
import { SectionBoundary } from "@/components/SectionBoundary";
import { PortableTextView } from "@/components/shared/PortableTextView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { ArrowLeftIcon, LockIcon, MessageSquareIcon, Share2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

// Format a date string as relative time (e.g. "3h ago", "2d ago")
// 将日期字符串格式化为相对时间
function formatRelativeTime(
  iso: string,
  time: {
    readonly justNow: string;
    readonly minutesAgo: (n: number) => string;
    readonly hoursAgo: (n: number) => string;
    readonly daysAgo: (n: number) => string;
    readonly monthsAgo: (n: number) => string;
    readonly yearsAgo: (n: number) => string;
  },
): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return time.justNow;
  if (diffMin < 60) return time.minutesAgo(diffMin);
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return time.hoursAgo(diffHours);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return time.daysAgo(diffDays);
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return time.monthsAgo(diffMonths);
  return time.yearsAgo(Math.floor(diffMonths / 12));
}

function PostDetailInner({ id }: { readonly id: string }) {
  const [t] = useT();
  const router = useRouter();
  const result = useAtomSuspense(postQuery(id));
  const post = result.value;

  const displayTitle = post.title ?? t.post.untitled;
  const isEdited = post.updatedAt !== post.createdAt;
  const portableContent = post.content ?? null;

  function handleShare() {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.unitId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Back nav / 返回导航 */}
      <div className="flex items-center gap-2 text-sm">
        <Button onClick={() => router.back()} size="sm" variant="ghost">
          <ArrowLeftIcon />
          {t.post.back}
        </Button>
      </div>

      {/* Post content card / 帖子内容卡片 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* Title + badges / 标题 + 徽章 */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold leading-snug wrap-anywhere">{displayTitle}</h1>
            {post.isLocked && (
              <Badge variant="warning">
                <LockIcon /> {t.post.locked}
              </Badge>
            )}
          </div>

          {/* Meta row / 元信息行 */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
            <span className="shrink-0">{t.post.by}</span>
            <span className="truncate">{post.authorUserId}</span>
            <span className="shrink-0" aria-hidden>·</span>
            <time className="shrink-0" dateTime={post.createdAt}>
              {formatRelativeTime(post.createdAt, t.time)}
            </time>
            {isEdited && <span className="shrink-0 italic">({t.post.edited})</span>}
          </div>

          {/* Body / 正文 */}
          {portableContent !== null && (
            <PortableTextView value={portableContent} />
          )}
          {portableContent === null && post.summary !== null && (
            <p className="text-sm leading-relaxed">{post.summary}</p>
          )}

          {/* Actions / 操作栏 */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-1 border-t pt-3">
            <span className="flex items-center gap-1 text-xs">
              <MessageSquareIcon className="size-3.5" />
              {t.post.replyCount(post.replyCount)}
            </span>
            <Button onClick={handleShare} size="xs" variant="ghost">
              <Share2Icon />
              {t.post.share}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comment section placeholder / 评论区占位 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t.post.commentsTitle}</h2>
        {post.isLocked ? (
          <p className="bg-muted/48 text-muted-foreground rounded-lg border p-3 text-sm">
            {t.post.locked}
          </p>
        ) : (
          <div className="border-input bg-background rounded-md border p-3 text-sm">
            <p className="text-muted-foreground">{t.post.commentPlaceholder}</p>
          </div>
        )}
        <p className="text-muted-foreground py-4 text-center text-sm">{t.common.empty}</p>
      </section>
    </div>
  );
}

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [<- Back]                   |
 * |-----------------------------|
 * | Title (h1)        [Locked] |
 * | by author · 3h ago         |
 * | [PortableText body]        |
 * | --- border ---              |
 * | Replies 5  [Share]         |
 * |-----------------------------|
 * | Comments                    |
 * | [Composer placeholder]     |
 * | "Nothing here yet"         |
 * +-----------------------------+
 * w-full single column, card fills width.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [<- Back]                            |
 * |--------------------------------------|
 * | Title (h1)               [Locked]   |
 * | by author · 3h ago                  |
 * | [PortableText body]                 |
 * | --- border ---                       |
 * | Replies 5  [Share]                  |
 * |--------------------------------------|
 * | Comments                             |
 * | [Composer placeholder]              |
 * | "Nothing here yet"                  |
 * +--------------------------------------+
 * Same structure. max-w-3xl mx-auto from parent page.
 *
 * Desktop (1024-1535px):
 * +---------------------------------------------+
 * | [<- Back]                                   |
 * |---------------------------------------------|
 * | Title (h1)                     [Locked]    |
 * | by author · 3h ago                         |
 * | [PortableText body]                        |
 * | --- border ---                              |
 * | Replies 5  [Share]                         |
 * |---------------------------------------------|
 * | Comments                                    |
 * | [Composer placeholder]                     |
 * | "Nothing here yet"                         |
 * +---------------------------------------------+
 * Same structure. max-w-3xl centered with wider margins.
 *
 * Ultra-wide (>=1536px):
 * +-------------------------------------------------------+
 * |      [<- Back]                                        |
 * |-------------------------------------------------------|
 * |      Title (h1)                      [Locked]        |
 * |      by author · 3h ago                              |
 * |      [PortableText body]                             |
 * |      --- border ---                                   |
 * |      Replies 5  [Share]                              |
 * |-------------------------------------------------------|
 * |      Comments                                         |
 * |      [Composer placeholder]                          |
 * |      "Nothing here yet"                              |
 * +-------------------------------------------------------+
 * Same structure. max-w-3xl (48rem) centered, large symmetric margins.
 *
 * w-full max-w-3xl mx-auto 居中容器（由 page.tsx 提供）。单列布局，无响应式断点差异。
 * 行宽处置：返回行 = [Back] 按钮 shrink-0；标题行 = h1（wrap-anywhere）+ 徽章（shrink-0），flex-wrap；
 * meta 行 = 作者（truncate）+ 分隔点 + 时间（shrink-0），flex-wrap；
 * 操作栏 = 回复计数 + 分享按钮，flex-wrap。
 * 边界：content 为 null -> 显示 summary 回退。summary 也为 null -> 不显示正文。
 *       isLocked -> 评论区替换为锁定提示。title 为 null -> 显示 "Untitled"。
 */
export function PostDetailContent({ id }: { readonly id: string }) {
  return (
    <SectionBoundary>
      <PostDetailInner id={id} />
    </SectionBoundary>
  );
}
