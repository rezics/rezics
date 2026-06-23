"use client";

import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rating } from "@/components/ui/rating";
import { useT } from "@/lib/i18n/locale";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * 书评编辑器：目标书籍选择 + 标题 + 评分 + 正文。
 * 使用 (editor) layout（无侧栏/底部导航），max-w-3xl mx-auto。
 */
export default function NewReviewPage() {
  const [t] = useT();
  const [title, setTitle] = useState("");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link aria-label="Back" href="/"><ArrowLeftIcon /></Link>
          </Button>
          <h1 className="text-lg font-semibold">{t.newReview.heading}</h1>
        </div>
        <Button size="sm">{t.newReview.publish}</Button>
      </div>

      <div className="space-y-4">
        <Input aria-label="Search for a book to review" placeholder={t.newReview.searchPlaceholder} type="search" />
        <Input aria-label="Review title" onChange={(e) => setTitle(e.target.value)} placeholder={t.newReview.titlePlaceholder} value={title} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" id="rating-label">{t.newReview.rating}</span>
          <Rating aria-labelledby="rating-label" count={10} />
        </div>
        <div className="border-input min-h-64 rounded-md border p-4">
          <PortableTextEditor />
        </div>
      </div>
    </div>
  );
}
