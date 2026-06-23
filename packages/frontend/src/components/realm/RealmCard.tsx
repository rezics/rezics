"use client";

import { Card } from "@/components/ui/card";
import type { Realm } from "@rezics/backend/api";
import { UsersIcon } from "lucide-react";
import Link from "next/link";

interface RealmCardProps {
  readonly realm: Realm;
}

/**
 * Mobile / Tablet / Desktop / Ultra-wide (all identical -- no responsive breakpoints):
 *
 * +---------------------------------------------------+
 * | (Icon)  Realm Name                                |
 * | shrink-0 ^- wrap-anywhere -^                      |
 * |          42 members                               |
 * +---------------------------------------------------+
 *  ^ icon   ^------- min-w-0 flex-1 ----------------^
 *
 * 卡片横向布局（flex-row items-center gap-3）：圆形图标占位（size-10，
 * shrink-0，bg-muted）+ 内容区（min-w-0 flex-1）。所有断点布局一致。
 * 窄端：名称 wrap-anywhere（超长无空格名断行）。
 * 宽端：内容区 flex-1 吃满卡片余宽，卡片宽度由父级列封顶。
 * 成员数行 text-xs text-muted-foreground。
 */
export function RealmCard({ realm }: RealmCardProps) {
  const [t] = useT();

  return (
    <Card className="flex-row items-center gap-3 p-3 [--space:--spacing(3)]">
      <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
        <UsersIcon className="text-muted-foreground size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <Link className="font-semibold wrap-anywhere hover:underline" href={`/r/${realm.slug}`}>
          {realm.name}
        </Link>
      </div>
    </Card>
  );
}
