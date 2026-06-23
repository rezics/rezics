import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpenIcon,
  FileTextIcon,
  MessageSquareIcon,
  NotebookPenIcon,
  QuoteIcon,
  BarChart3Icon,
} from "lucide-react";
import Link from "next/link";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Create                      |
 * | What would you like to...   |
 * |-----------------------------|
 * | [Post     ] [Review    ]   |
 * | [Excerpt  ] [Remark    ]   |
 * | [Poll     ] [Book      ]   |
 * +-----------------------------+
 * grid-cols-2, gap-3, full width.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Create                               |
 * | What would you like to share?        |
 * |--------------------------------------|
 * | [Post     ] [Review    ] [Excerpt ]  |
 * | [Remark   ] [Poll      ] [Book    ]  |
 * +--------------------------------------+
 * grid-cols-3, max-w-2xl mx-auto.
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | Create                                   |
 * | What would you like to share?            |
 * |------------------------------------------|
 * | [Post] [Review] [Excerpt] [Remark]       |
 * | [Poll] [Book  ] [Entity ] [Shelf ]       |
 * +------------------------------------------+
 * grid-cols-3, max-w-2xl mx-auto.
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 *
 * 统一创建入口：选择要创建的内容类型，跳转到对应编辑器。
 * 每个卡片包含图标 + 标题 + 简短描述。
 */
export default function CreatePage() {
  const items = [
    {
      href: "/post/new",
      icon: MessageSquareIcon,
      title: "Post",
      description: "Share a thought or start a discussion",
    },
    {
      href: "/review/new",
      icon: NotebookPenIcon,
      title: "Review",
      description: "Write an in-depth review of a work",
    },
    {
      href: "/excerpt/new",
      icon: QuoteIcon,
      title: "Excerpt",
      description: "Share a passage from a book",
    },
    {
      href: "/remark/new",
      icon: FileTextIcon,
      title: "Remark",
      description: "Write a short note or comment",
    },
    {
      href: "/poll/new",
      icon: BarChart3Icon,
      title: "Poll",
      description: "Create a community poll",
    },
    {
      href: "/book/new",
      icon: BookOpenIcon,
      title: "Book",
      description: "Add a new book to the catalog",
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">Create</h1>
        <p className="text-muted-foreground text-sm">What would you like to share?</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(({ href, icon: Icon, title, description }) => (
          <Link href={href} key={href}>
            <Card className="hover:bg-accent h-full transition-colors">
              <CardHeader className="pb-2">
                <Icon className="text-muted-foreground mb-1 size-5" />
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
