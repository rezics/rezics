"use client";

import { ArrowLeftIcon, GripVerticalIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [<-] Edit Shelf      [Save] |
 * |-----------------------------|
 * | Shelf Name                  |
 * | [input full width         ] |
 * | Description                 |
 * | [textarea full width     ]  |
 * | [                         ] |
 * |-----------------------------|
 * | Items                       |
 * | [=] Item title 1     [del]  |
 * | [=] Item title 2     [del]  |
 * |       (empty state)         |
 * +-----------------------------+
 * w-full. Form fields stacked. Items list with grip handle (shrink-0) +
 * title (min-w-0 flex-1 truncate) + delete button (shrink-0).
 * Narrow: title truncates, buttons stay fixed.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [<-] Edit Shelf           [Save]     |
 * |--------------------------------------|
 * | Shelf Name                           |
 * | [input full width                 ]  |
 * | Description                          |
 * | [textarea full width              ]  |
 * |--------------------------------------|
 * | Items                                |
 * | [=] Item title 1              [del]  |
 * | [=] Item title 2              [del]  |
 * +--------------------------------------+
 * max-w-3xl mx-auto.
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [<-] Edit Shelf                 [Save]   |
 * |------------------------------------------|
 * | Shelf Name                               |
 * | [input full width                     ]  |
 * | Description                              |
 * | [textarea full width                  ]  |
 * |------------------------------------------|
 * | Items                                    |
 * | [=] Item title 1                  [del]  |
 * | [=] Item title 2                  [del]  |
 * +------------------------------------------+
 * max-w-3xl mx-auto (editor layout caps at max-w-4xl).
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop.
 *
 * 书架编辑器：名称 + 描述 + 可拖拽排序的项目列表。
 * 使用 (editor) layout（无侧栏/底部导航）。
 */

export interface ShelfItem {
  readonly id: string;
  readonly title: string;
}

export function EditShelfEditor({
  initialDescription = "",
  initialItems = [],
  initialName = "",
}: {
  readonly initialDescription?: string;
  readonly initialItems?: readonly ShelfItem[];
  readonly initialName?: string;
} = {}) {
  const [t] = useT();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [items, setItems] = useState<readonly ShelfItem[]>(initialItems);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header: back + title + save */}
      {/* 页头：返回 + 标题 + 保存 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">{t.editor.editShelf}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline">
            {t.editor.saveDraft}
          </Button>
          <Button size="sm">{t.common.save}</Button>
        </div>
      </div>

      {/* Form fields */}
      {/* 表单字段 */}
      <div className="space-y-4">
        <Field>
          <FieldLabel>{t.editor.shelfName}</FieldLabel>
          <Input
            onChange={(e) => setName(e.target.value)}
            placeholder={t.editor.shelfNamePlaceholder}
            value={name}
          />
        </Field>

        <Field>
          <FieldLabel>{t.editor.shelfDescription}</FieldLabel>
          <Textarea
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.editor.shelfDescriptionPlaceholder}
            value={description}
          />
        </Field>
      </div>

      {/* Items list */}
      {/* 项目列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t.editor.shelfItems}</h2>
        </div>

        {items.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            <p>{t.editor.shelfItemsEmpty}</p>
            <p className="text-muted-foreground/60 mt-1 text-xs">
              {t.editor.shelfItemsHint}
            </p>
          </div>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {items.map((item) => (
              <li className="flex items-center gap-2 px-3 py-2" key={item.id}>
                {/* Drag handle — fixed */}
                {/* 拖拽手柄 — 固定 */}
                <GripVerticalIcon className="text-muted-foreground size-4 shrink-0 cursor-grab" />

                {/* Title — truncates when narrow */}
                {/* 标题 — 窄屏时截断 */}
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.title}
                </span>

                {/* Remove button — fixed */}
                {/* 移除按钮 — 固定 */}
                <Button
                  className="shrink-0"
                  onClick={() => removeItem(item.id)}
                  size="xs"
                  variant="ghost"
                >
                  {t.common.delete}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function EditShelfPage() {
  return <EditShelfEditor />;
}
