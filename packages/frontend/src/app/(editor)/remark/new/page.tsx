"use client";

import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

/**
 * 短评编辑器：目标书籍选择 + 正文（较短）。
 */
export default function NewRemarkPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/"><ArrowLeftIcon /></Link>
          </Button>
          <h1 className="text-lg font-semibold">New Remark</h1>
        </div>
        <Button size="sm">Publish</Button>
      </div>

      <div className="space-y-4">
        <Input placeholder="Search for a book..." type="search" />
        <div className="border-input min-h-32 rounded-md border p-4">
          <PortableTextEditor />
        </div>
      </div>
    </div>
  );
}
