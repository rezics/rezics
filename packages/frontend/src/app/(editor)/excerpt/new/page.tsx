"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/locale";

/**
 * 书摘编辑器：书籍选择 + 章节 + 引文 + 评注。
 */
export function NewExcerptEditor({
  initialChapter = "",
  initialNotes = "",
  initialPassage = "",
  initialSearch = "",
}: {
  readonly initialChapter?: string;
  readonly initialNotes?: string;
  readonly initialPassage?: string;
  readonly initialSearch?: string;
} = {}) {
  const [t] = useT();
  const [chapter, setChapter] = useState(initialChapter);
  const [passage, setPassage] = useState(initialPassage);
  const [search, setSearch] = useState(initialSearch);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link aria-label="Back" href="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">{t.newExcerpt.heading}</h1>
        </div>
        <Button size="sm">{t.newExcerpt.publish}</Button>
      </div>

      <div className="space-y-4">
        <Input
          aria-label="Search for a book"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.newExcerpt.searchPlaceholder}
          type="search"
          value={search}
        />
        <Input
          aria-label="Chapter or section"
          onChange={(e) => setChapter(e.target.value)}
          placeholder={t.newExcerpt.chapterPlaceholder}
          value={chapter}
        />
        <Textarea
          aria-label="Passage"
          className="min-h-32"
          onChange={(e) => setPassage(e.target.value)}
          placeholder={t.newExcerpt.passagePlaceholder}
          value={passage}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium">
            {t.newExcerpt.notesLabel}
          </p>
          <div className="border-input min-h-24 rounded-md border p-4">
            <PortableTextEditor value={initialNotes} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewExcerptPage() {
  return <NewExcerptEditor />;
}
