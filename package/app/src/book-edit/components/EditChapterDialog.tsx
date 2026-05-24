import type { ContentRating } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { RatingSelector } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useEffect, useState } from "react";
import type { Chapter } from "./BookTocEditor";

// MOCK: publish statuses — replace with contract enum when backend is ready
const PUBLISH_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type PublishStatus = (typeof PUBLISH_STATUSES)[number];

const PUBLISH_STATUS_LABEL = {
  DRAFT: m.book_chapter_status_draft,
  PUBLISHED: m.book_chapter_status_published,
  ARCHIVED: m.book_chapter_status_archived,
} as const satisfies Record<PublishStatus, () => string>;

interface EditChapterDialogProps {
  open: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  onSave: (update: {
    title: string;
    status: PublishStatus;
    rating: ContentRating;
  }) => void;
}

export function EditChapterDialog({
  open,
  onClose,
  chapter,
  onSave,
}: EditChapterDialogProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [rating, setRating] = useState<ContentRating>("GENERAL");

  useEffect(() => {
    if (open && chapter) {
      setTitle(chapter.title);
      // Mock: read status from chapter metadata if available, default DRAFT
      setStatus((chapter as any).status ?? "DRAFT");
      setRating(chapter.rating ?? "GENERAL");
    }
  }, [open, chapter]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), status, rating });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{m.book_chapter_edit_dialog_title()}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 pt-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-chapter-title">{m.book_fields_title()}</Label>
            <Input
              id="edit-chapter-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className={!title.trim() ? "border-border-error" : ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-chapter-status">
              {m.book_chapter_edit_dialog_status()}
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PublishStatus)}
            >
              <SelectTrigger id="edit-chapter-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PUBLISH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PUBLISH_STATUS_LABEL[s]()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RatingSelector value={rating} onChange={setRating} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
