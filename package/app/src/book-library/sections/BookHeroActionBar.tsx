import { useUnitProgress, useUpdateUnitProgress } from "@rezics/api";
import { useCanEdit } from "@rezics/api/hooks";
import type { BookDTO } from "@rezics/contract";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import {
  BookmarkPlus as BookmarkAddOutlined,
  CircleCheck as CheckCircleOutline,
  Pause as PauseOutlined,
  Pencil as EditOutlined,
  Share as IosShareOutlined,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShareMenu } from "@/engagement/hooks/useShareMenu";

interface BookHeroActionBarProps {
  bookInfo: BookDTO;
  shareTitle?: string;
}

type ReadStatus = "want" | "reading" | "paused" | "read" | null;

function mapProgressStatus(status: string | undefined): ReadStatus {
  switch (status) {
    case "BACKLOG":
      return "want";
    case "ACTIVE":
      return "reading";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "read";
    default:
      return null;
  }
}

// Ghost button styling for hero overlay surfaces (white text on dark backdrop).
const ghostHeroClass =
  "text-white/90 border-white/25 rounded-full hover:border-white/50 hover:bg-white/10 bg-transparent";

export const BookHeroActionBar: React.FC<BookHeroActionBarProps> = ({
  bookInfo,
  shareTitle,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "book", ownerUnit: bookInfo });
  const bookId = bookInfo?.unitId ?? "";

  const progress = useUnitProgress(bookId);
  const updateProgress = useUpdateUnitProgress(bookId);
  const readStatus = mapProgressStatus(progress.data?.status);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completedCountInput, setCompletedCountInput] = useState("1");
  const share = useShareMenu({
    href: bookId ? `/book/${bookId}` : "/",
    title: shareTitle,
  });

  const handleAddToShelf = () => {
    // MOCK: route to the shelves-by-book page until a shelf-picker dialog exists.
    navigate({ to: "/shelf/book/$bookId", params: { bookId } });
  };

  const handleEdit = () => {
    if (bookId) navigate({ to: "/book/$bookId/edit", params: { bookId } });
  };

  const handleReadStatusChange = (value: string) => {
    if (!bookId || !value) return;

    if (value === "read") {
      setCompletedCountInput(String((progress.data?.completedCount ?? 0) + 1));
      setCompleteDialogOpen(true);
      return;
    }

    const status =
      value === "want" ? "BACKLOG" : value === "paused" ? "PAUSED" : "ACTIVE";
    updateProgress.mutate({ status });
  };

  const confirmCompleted = async () => {
    if (!bookId) return;

    const completedCount = Math.max(
      0,
      Number.parseInt(completedCountInput, 10) || 0,
    );
    await updateProgress.mutateAsync({
      status: "COMPLETED",
      progress: 1,
      completedCount,
    });
    setCompleteDialogOpen(false);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <Button
        size="lg"
        onClick={handleAddToShelf}
        className="rounded-full font-medium"
        style={{
          backgroundColor: "var(--colors-brand-fill, #f4606c)",
          color: "var(--colors-text-on-brand, #fff)",
        }}
      >
        <BookmarkAddOutlined className="w-4 h-4 mr-2" />
        {t("book.hero.actions.add_to_shelf", "加入書架")}
      </Button>

      <ToggleGroup
        type="single"
        size="sm"
        value={readStatus ?? ""}
        onValueChange={handleReadStatusChange}
        className="w-full grid grid-cols-2 sm:grid-cols-4"
      >
        <ToggleGroupItem
          value="want"
          className="rounded-full text-white/80 border border-white/20 hover:bg-white/10 data-[state=on]:bg-white/12 data-[state=on]:text-white data-[state=on]:border-white/40 text-xs py-1"
        >
          {t("book.hero.actions.want_to_read", "想讀")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="reading"
          className="rounded-full text-white/80 border border-white/20 hover:bg-white/10 data-[state=on]:bg-white/12 data-[state=on]:text-white data-[state=on]:border-white/40 text-xs py-1"
        >
          {t("book.hero.actions.reading", "在讀")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="paused"
          className="rounded-full text-white/80 border border-white/20 hover:bg-white/10 data-[state=on]:bg-white/12 data-[state=on]:text-white data-[state=on]:border-white/40 text-xs py-1"
        >
          <PauseOutlined className="w-3.5 h-3.5 mr-1" />
          {t("book.hero.actions.paused", "擱置")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="read"
          className="rounded-full text-white/80 border border-white/20 hover:bg-white/10 data-[state=on]:bg-white/12 data-[state=on]:text-white data-[state=on]:border-white/40 text-xs py-1"
        >
          <CheckCircleOutline className="w-3.5 h-3.5 mr-1" />
          {t("book.hero.actions.read", "已讀")}
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="flex items-stretch gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton
            render={(props) => (
              <Button
                variant="outline"
                size="default"
                onClick={share.handleOpen}
                className={`flex-1 ${ghostHeroClass}`}
                {...props}
              >
                <IosShareOutlined className="w-4 h-4 mr-2" />
                {t("common.share", "分享")}
              </Button>
            )}
          />
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={share.handleCopy}>
              {t("common.copy_link", "複製連結")}
            </DropdownMenuItem>
            {share.canWebShare && (
              <DropdownMenuItem onClick={share.handleWebShare}>
                {t("common.share_via", "分享…")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {canEdit && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={t(
                      "book.hero.actions.edit_details",
                      "編輯書籍詳情",
                    )}
                    onClick={handleEdit}
                    className={ghostHeroClass}
                    {...props}
                  >
                    <EditOutlined className="w-4 h-4" />
                  </Button>
                )}
              />
              <TooltipContent side="top">
                {t("book.hero.actions.edit_details", "編輯書籍詳情")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <Dialog
        open={completeDialogOpen}
        onOpenChange={(open) => !open && setCompleteDialogOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("book.hero.complete_dialog.title", "標記為已完成")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "book.hero.complete_dialog.description",
                "確認後會將進度設為 100%，並更新這部作品的完成次數。",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="book-completed-count">
              {t("book.hero.complete_dialog.completed_count", "完成次數")}
            </Label>
            <Input
              id="book-completed-count"
              type="number"
              min={0}
              inputMode="numeric"
              value={completedCountInput}
              onChange={(event) => setCompletedCountInput(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCompleteDialogOpen(false)}
            >
              {t("common.cancel", "取消")}
            </Button>
            <Button
              type="button"
              onClick={confirmCompleted}
              disabled={updateProgress.isPending}
            >
              {t("common.confirm", "確認")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
