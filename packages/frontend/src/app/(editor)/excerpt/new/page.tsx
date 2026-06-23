"use client";

import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * 书摘编辑器：书籍选择 + 章节 + 引文 + 评注。
 */
export default function NewExcerptPage() {
  const [passage, setPassage] = useState("");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/"><ArrowLeftIcon /></Link>
          </Button>
          <h1 className="text-lg font-semibold">New Excerpt</h1>
        </div>
        <Button size="sm">Publish</Button>
      </div>

      <div className="space-y-4">
        <Input placeholder="Search for a book..." type="search" />
        <Input placeholder="Chapter or section (optional)" />
        <Textarea
          className="min-h-32"
          onChange={(e) => setPassage(e.target.value)}
          placeholder="Paste or type the passage..."
          value={passage}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium">Your notes (optional)</p>
          <div className="border-input min-h-24 rounded-md border p-4">
            <PortableTextEditor />
          </div>
        </div>
      </div>
    </div>
  );
}
