"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";

interface BookCardProps {
  readonly unitId: string;
  readonly title: string;
  readonly slug: string | null;
  readonly status: string;
  readonly chapterCount: number;
}

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [cover 48x64] Title         |
 * |              Status · Ch#   |
 * +-----------------------------+
 * w-full, cover left, text right, truncate title.
 *
 * Tablet (640-1023px):
 * +-----------------------------+
 * | [cover 48x64] Title         |
 * |              Status · Ch#   |
 * +-----------------------------+
 * 与移动端一致。
 *
 * Desktop (1024-1535px):
 * +-----------------------------+
 * | [cover 48x64] Title         |
 * |              Status · Ch#   |
 * +-----------------------------+
 * 与移动端一致（卡片内容不随视口变化）。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 *
 * 书籍卡片：封面 + 标题 + 状态/章节数。
 * 整个卡片可点击跳转到 /book/[id]。
 * 标题超长时 truncate，封面占位图标 shrink-0。
 */
export function BookCard({ unitId, title, slug, status, chapterCount }: BookCardProps) {
  return (
    <Link href={`/book/${unitId}`}>
      <Card className="hover:bg-accent transition-colors">
        <CardContent className="flex items-center gap-3 p-3">
          <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded sm:h-16 sm:w-12">
            <BookOpenIcon className="text-muted-foreground size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title || slug || unitId}</p>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Badge className="text-[10px]" variant="outline">{status}</Badge>
              <span>{chapterCount} chapters</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
