import { useCanEdit } from "@rezics/api/hooks";
import type { BookDTO } from "@rezics/contract";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

// MOCK: read-status state lives in component memory. Swap for the real
// shelf-membership hook once we expose `currently-reading / read / want-to-read`
// status from the backend.
type ReadStatus = "want" | "reading" | "read" | null;

// Ghost button styling for hero overlay surfaces (white text on dark backdrop).
const ghostHeroClass =
  "text-white/90 border-white/25 rounded-md hover:border-white/50 hover:bg-white/10 bg-transparent";

export const BookHeroActionBar: React.FC<BookHeroActionBarProps> = ({
  bookInfo,
  shareTitle,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "book", ownerUnit: bookInfo });
  const bookId = bookInfo?.unitId ?? "";

  const [readStatus, setReadStatus] = useState<ReadStatus>(null);
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

  return (
    <div className="flex flex-col gap-3 w-full">
      <Button
        size="lg"
        onClick={handleAddToShelf}
        className="rounded-md font-medium"
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
        onValueChange={(v) => setReadStatus((v as ReadStatus) || null)}
        className="w-full grid grid-cols-3"
      >
        <ToggleGroupItem
          value="want"
          className="text-white/80 border border-white/20 hover:bg-white/10 data-[state=on]:bg-white/12 data-[state=on]:text-white data-[state=on]:border-white/40 text-xs py-1"
        >
          {t("book.hero.actions.want_to_read", "想讀")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="reading"
          className="text-white/80 border border-white/20 hover:bg-white/10 data-[state=on]:bg-white/12 data-[state=on]:text-white data-[state=on]:border-white/40 text-xs py-1"
        >
          {t("book.hero.actions.reading", "在讀")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="read"
          className="text-white/80 border border-white/20 hover:bg-white/10 data-[state=on]:bg-white/12 data-[state=on]:text-white data-[state=on]:border-white/40 text-xs py-1"
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
    </div>
  );
};
