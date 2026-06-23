"use client";

import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/locale";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [<-] New Post     [Publish] |
 * |-----------------------------|
 * | Title                       |
 * | [input full width         ] |
 * |-----------------------------|
 * | [Portable Text Editor     ] |
 * | [                         ] |
 * | [                         ] |
 * +-----------------------------+
 * w-full, editor takes full width.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [<-] New Post            [Publish]   |
 * |--------------------------------------|
 * | Title                                |
 * | [input full width                 ]  |
 * |--------------------------------------|
 * | [Portable Text Editor             ]  |
 * | [                                 ]  |
 * +--------------------------------------+
 * max-w-3xl mx-auto。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [<-] New Post                [Publish]   |
 * |------------------------------------------|
 * | Title                                    |
 * | [input full width                     ]  |
 * |------------------------------------------|
 * | [Portable Text Editor                 ]  |
 * | [                                     ]  |
 * +------------------------------------------+
 * max-w-3xl mx-auto，无侧栏（editor layout）。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 新帖编辑器：标题 + Portable Text 富文本编辑器。
 * 使用 (editor) layout（无侧栏/底部导航）。
 */
export default function NewPostPage() {
  const [t] = useT();
  const [title, setTitle] = useState("");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link aria-label="Back" href="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">{t.newPost.heading}</h1>
        </div>
        <Button size="sm">{t.newPost.publish}</Button>
      </div>

      <div className="space-y-4">
        <Input
          aria-label="Post title"
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.newPost.titlePlaceholder}
          value={title}
        />
        <div className="border-input min-h-64 rounded-md border p-4">
          <PortableTextEditor />
        </div>
      </div>
    </div>
  );
}
