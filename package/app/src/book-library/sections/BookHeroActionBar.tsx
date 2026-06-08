import { useEditorEntry } from "@rezics/api/hooks";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import {
  BookmarkPlus as BookmarkAddOutlined,
  Copy,
  Pencil as EditOutlined,
  FilePenLine,
  Share as IosShareOutlined,
  Send,
} from "lucide-react";
import type React from "react";
import { useShareMenu } from "@/engagement/hooks/useShareMenu";
import { BookProgressStatusSection } from "@/progress-status";

interface BookHeroActionBarProps {
  bookInfo: BookDTO;
  shareTitle?: string;
}

const ghostHeroClass =
  "text-white/90 border-white/25 rounded-full bg-transparent hover:border-white/50 hover:bg-white/10 hover:text-white aria-expanded:bg-white/10 aria-expanded:text-white";

export const BookHeroActionBar: React.FC<BookHeroActionBarProps> = ({
  bookInfo,
  shareTitle,
}) => {
  const { t } = useTranslation(["book", "common"]);
  const navigate = useNavigate();
  const editorEntry = useEditorEntry({
    surface: "book",
    ownerUnit: bookInfo,
    capabilities: ["content", "tag"],
  });
  const bookId = bookInfo?.unitId ?? "";

  const share = useShareMenu({
    href: bookId ? `/book/${bookId}` : "/",
    title: shareTitle,
    targetId: bookId || undefined,
  });

  const handleAddToShelf = () => {
    // MOCK: route to the shelves-by-book page until a shelf-picker dialog exists.
    // MOCK：在书架选择器对话框出现之前，先跳转到按书查看书架的页面。
    navigate({ to: "/shelf/book/$bookId", params: { bookId } });
  };

  const handleEdit = () => {
    if (bookId) navigate({ to: "/book/$bookId/edit", params: { bookId } });
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <Button
        size="lg"
        onClick={handleAddToShelf}
        className="rounded-full font-medium"
        style={{
          backgroundColor: "var(--colors-brand-fill, #DB515C)",
          color: "var(--colors-text-on-brand, #fff)",
        }}
      >
        <BookmarkAddOutlined className="w-4 h-4 mr-2" />
        {t("book:hero_actions_add_to_shelf")}
      </Button>

      {bookId ? <BookProgressStatusSection bookUnitId={bookId} /> : null}

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
                {t("common:share")}
              </Button>
            )}
          />
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>{t("common:share_to_rezics")}</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={!share.canInternalShare || share.isInternalSharePending}
              onClick={share.handleDirectShare}
            >
              <Send className="h-4 w-4" aria-hidden />
              {t("common:share_direct")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!share.canInternalShare || share.isInternalSharePending}
              onClick={share.handleWriteShare}
            >
              <FilePenLine className="h-4 w-4" aria-hidden />
              {t("common:share_write")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={share.handleCopy}>
              <Copy className="h-4 w-4" aria-hidden />
              {t("common:copy_link")}
            </DropdownMenuItem>
            {share.canWebShare && (
              <DropdownMenuItem onClick={share.handleWebShare}>
                <IosShareOutlined className="h-4 w-4" aria-hidden />
                {t("common:share_via")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {share.authModal}

        {editorEntry.canEnter && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={t("book:hero_actions_edit_details")}
                    {...props}
                    onClick={handleEdit}
                    className={ghostHeroClass}
                  >
                    <EditOutlined className="w-4 h-4" />
                  </Button>
                )}
              />
              <TooltipContent side="top">
                {t("book:hero_actions_edit_details")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};
