import { useCanEdit } from "@rezics/api/hooks";
import type { BookDTO } from "@rezics/contract";
import {
  book_hero_actions_add_to_shelf,
  book_hero_actions_edit_details,
  common_copy_link,
  common_share,
  common_share_via,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import {
  BookmarkPlus as BookmarkAddOutlined,
  Pencil as EditOutlined,
  Share as IosShareOutlined,
} from "lucide-react";
import type React from "react";
import { useShareMenu } from "@/engagement/hooks/useShareMenu";
import { BookProgressStatusSection } from "@/progress-status";

const i18nMessages = {
  book_hero_actions_add_to_shelf,
  book_hero_actions_edit_details,
  common_copy_link,
  common_share,
  common_share_via,
};

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
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "book", ownerUnit: bookInfo });
  const bookId = bookInfo?.unitId ?? "";

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
        className="rounded-full font-medium"
        style={{
          backgroundColor: "var(--colors-brand-fill, #f4606c)",
          color: "var(--colors-text-on-brand, #fff)",
        }}
      >
        <BookmarkAddOutlined className="w-4 h-4 mr-2" />
        {m.book_hero_actions_add_to_shelf()}
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
                {m.common_share()}
              </Button>
            )}
          />
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={share.handleCopy}>
              {m.common_copy_link()}
            </DropdownMenuItem>
            {share.canWebShare && (
              <DropdownMenuItem onClick={share.handleWebShare}>
                {m.common_share_via()}
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
                    aria-label={m.book_hero_actions_edit_details()}
                    {...props}
                    onClick={handleEdit}
                    className={ghostHeroClass}
                  >
                    <EditOutlined className="w-4 h-4" />
                  </Button>
                )}
              />
              <TooltipContent side="top">
                {m.book_hero_actions_edit_details()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};
