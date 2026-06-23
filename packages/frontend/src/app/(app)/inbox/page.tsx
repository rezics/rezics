import { SectionBoundary } from "@/components/SectionBoundary";
import { InboxContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Inbox                       |
 * | [Notifications|Messages]    |
 * |-----------------------------|
 * | [notification item]         |
 * | [notification item]         |
 * |       [Load more]           |
 * +-----------------------------+
 * w-full, tabs horizontally.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Inbox                                |
 * | [Notifications | Messages]           |
 * |--------------------------------------|
 * | [notification item]                  |
 * |           [Load more]               |
 * +--------------------------------------+
 * max-w-3xl mx-auto。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | Inbox                                    |
 * | [Notifications | Messages]               |
 * |------------------------------------------|
 * | [notification item]                      |
 * |           [Load more]                    |
 * +------------------------------------------+
 * max-w-3xl mx-auto。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 *
 * 收件箱：通知 + 私信 tabs。
 * 通知列表分页加载，私信列表显示对话。
 */
export default function InboxPage() {
  return (
    <SectionBoundary>
      <InboxContent />
    </SectionBoundary>
  );
}
