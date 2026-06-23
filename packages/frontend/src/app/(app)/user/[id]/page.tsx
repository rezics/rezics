import { SectionBoundary } from "@/components/SectionBoundary";
import { UserProfileContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | (avatar 64px)               |
 * | Display Name                |
 * | @username                   |
 * | Bio text...                 |
 * | [Follow] [Message]          |
 * |-----------------------------|
 * | [Posts|Reviews|Shelves|...] |
 * |  ^tabs, overflow-x-auto    |
 * |-----------------------------|
 * | [PostCard]                  |
 * | [PostCard]                  |
 * |       [Load more]           |
 * +-----------------------------+
 * w-full, avatar + info stacked vertically.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | (avatar 80px) Display Name           |
 * |               @username  [Follow]    |
 * |               Bio text...            |
 * |--------------------------------------|
 * | [Posts | Reviews | Shelves | Realms] |
 * |--------------------------------------|
 * | [PostCard]                           |
 * |           [Load more]               |
 * +--------------------------------------+
 * max-w-3xl mx-auto，avatar 与信息横排。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | (avatar 96px) Display Name               |
 * |               @username  [Follow] [Msg]  |
 * |               Bio text...                |
 * |               Joined: 2024-01-01         |
 * |------------------------------------------|
 * | [Posts | Reviews | Shelves | Realms ]    |
 * |------------------------------------------|
 * | [PostCard]                               |
 * |           [Load more]                    |
 * +------------------------------------------+
 * max-w-3xl mx-auto。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 结构一致，max-w-3xl mx-auto 居中。
 *
 * 用户主页：头像 + 名称 + bio + 操作按钮 + tabs 切换内容。
 * 页面 ID 从 URL 参数获取。
 */
export default function UserProfilePage({ params }: { readonly params: Promise<{ id: string }> }) {
  return (
    <SectionBoundary>
      <UserProfileContent paramsPromise={params} />
    </SectionBoundary>
  );
}
