"use client";

import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rating } from "@/components/ui/rating";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * 书评编辑器：目标书籍选择 + 标题 + 评分 + 正文。
 * 使用 (editor) layout（无侧栏/底部导航），max-w-3xl mx-auto。
 */
export default function NewReviewPage() {
  const [title, setTitle] = useState("");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/"><ArrowLeftIcon /></Link>
          </Button>
          <h1 className="text-lg font-semibold">New Review</h1>
        </div>
        <Button size="sm">Publish</Button>
      </div>

      <div className="space-y-4">
        <Input placeholder="Search for a book to review..." type="search" />
        <Input onChange={(e) => setTitle(e.target.value)} placeholder="Review title" value={title} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Rating:</span>
          <Rating count={10} />
        </div>
        <div className="border-input min-h-64 rounded-md border p-4">
          <PortableTextEditor />
        </div>
      </div>
    </div>
  );
}
