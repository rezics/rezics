"use client";

import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | (text-muted centered)        |
 * | "No shelves yet"             |
 * +-------------------------------+
 * w-full. Centered empty message.
 *
 * Tablet (640-1023px):
 * +---------------------------------------+
 * | (text-muted centered)                |
 * | "No shelves yet"                     |
 * +---------------------------------------+
 * Same structure, wider from parent layout.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------------------+
 * | (text-muted centered)                            |
 * | "No shelves yet"                                 |
 * +--------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------------------------+
 * | (text-muted centered)                                      |
 * | "No shelves yet"                                           |
 * +------------------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * 用户书架列表页。目前后端尚无公开的用户书架列表端点，
 * 显示空状态占位。当 API 就绪后将替换为真实书架列表。
 * 所有断点布局一致，居中文字。
 */
export default function UserShelvesPage() {
  const [t] = useT();

  return (
    <p className="text-muted-foreground py-8 text-center text-sm">
      {t.user.emptyShelves}
    </p>
  );
}
