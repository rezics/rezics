"use client";

import { ArrowLeftIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PortableTextEditor } from "@/components/shared/PortableTextEditor";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [<-] Edit Book   [Publish]  |
 * |-----------------------------|
 * | Title                       |
 * | [input full width         ] |
 * | ISBN                        |
 * | [input full width         ] |
 * | Cover Image                 |
 * | [Upload cover  ]            |
 * | JPG or PNG, max 2 MB.       |
 * | Description                 |
 * | [portable text editor     ] |
 * | [                         ] |
 * +-----------------------------+
 * w-full. All fields stacked vertically.
 * Upload button full width on mobile.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [<-] Edit Book        [Draft][Pub]   |
 * |--------------------------------------|
 * | Title                                |
 * | [input full width                 ]  |
 * | ISBN                                 |
 * | [input full width                 ]  |
 * | Cover Image                          |
 * | [Upload cover  ]                     |
 * | JPG or PNG, max 2 MB.                |
 * | Description                          |
 * | [portable text editor             ]  |
 * +--------------------------------------+
 * max-w-3xl mx-auto. Upload button w-fit.
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [<-] Edit Book           [Draft] [Pub]   |
 * |------------------------------------------|
 * | Title                                    |
 * | [input full width                     ]  |
 * | ISBN                                     |
 * | [input full width                     ]  |
 * | Cover Image                              |
 * | [Upload cover  ]                         |
 * | JPG or PNG, max 2 MB.                    |
 * | Description                              |
 * | [portable text editor                 ]  |
 * +------------------------------------------+
 * max-w-3xl mx-auto (editor layout caps at max-w-4xl).
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop.
 *
 * 图书元数据编辑器：标题、ISBN、封面上传、描述（富文本）。
 * 使用 (editor) layout（无侧栏/底部导航）。
 */
export function EditBookEditor({
  initialDescription = "",
  initialIsbn = "",
  initialTitle = "",
}: {
  readonly initialDescription?: string;
  readonly initialIsbn?: string;
  readonly initialTitle?: string;
} = {}) {
  const [t] = useT();
  const [title, setTitle] = useState(initialTitle);
  const [isbn, setIsbn] = useState(initialIsbn);
  const [description, setDescription] = useState(initialDescription);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header: back + title + actions */}
      {/* 页头：返回 + 标题 + 操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">{t.editor.editBook}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline">
            {t.editor.saveDraft}
          </Button>
          <Button size="sm">{t.editor.publish}</Button>
        </div>
      </div>

      {/* Metadata form */}
      {/* 元数据表单 */}
      <div className="space-y-4">
        <Field>
          <FieldLabel>{t.editor.bookTitle}</FieldLabel>
          <Input
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.editor.bookTitlePlaceholder}
            value={title}
          />
        </Field>

        <Field>
          <FieldLabel>{t.editor.bookIsbn}</FieldLabel>
          <Input
            onChange={(e) => setIsbn(e.target.value)}
            placeholder={t.editor.bookIsbnPlaceholder}
            value={isbn}
          />
        </Field>

        {/* Cover upload */}
        {/* 封面上传 */}
        <Field>
          <FieldLabel>{t.editor.bookCover}</FieldLabel>
          <div>
            <Button size="sm" variant="outline">
              <UploadIcon className="mr-1.5 size-3.5" />
              {t.editor.bookCoverUpload}
            </Button>
          </div>
          <FieldDescription>{t.editor.bookCoverHint}</FieldDescription>
        </Field>

        {/* Rich-text description */}
        {/* 富文本描述 */}
        <Field>
          <FieldLabel>{t.editor.bookDescription}</FieldLabel>
          <div className="border-input min-h-48 rounded-md border p-4">
            <PortableTextEditor onChange={setDescription} value={description} />
          </div>
        </Field>
      </div>
    </div>
  );
}

export default function EditBookPage() {
  return <EditBookEditor />;
}
