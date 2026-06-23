"use client";

import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/locale";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

/**
 * 短评编辑器：目标书籍选择 + 正文（较短）。
 */
export default function NewRemarkPage() {
  const [t] = useT();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link aria-label="Back" href="/"><ArrowLeftIcon /></Link>
          </Button>
          <h1 className="text-lg font-semibold">{t.newRemark.heading}</h1>
        </div>
        <Button size="sm">{t.newRemark.publish}</Button>
      </div>

      <div className="space-y-4">
        <Input aria-label="Search for a book" placeholder={t.newRemark.searchPlaceholder} type="search" />
        <div className="border-input min-h-32 rounded-md border p-4">
          <PortableTextEditor />
        </div>
      </div>
    </div>
  );
}
