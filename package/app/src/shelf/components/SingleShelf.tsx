import { useCanEdit } from "@rezics/api/hooks";
import { contentDocMarkdownFallback, type ShelfDTO } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as EditOutlined } from "lucide-react";
import type React from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";

interface SingleShelfProps {
  shelf: ShelfDTO;
}

export const SingleShelf: React.FC<SingleShelfProps> = ({ shelf }) => {
  const translation = getTranslation(shelf.translations);
  const title = translation?.title ?? m.shelf_untitled();
  const description = contentDocMarkdownFallback(translation?.description);
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "shelf", ownerUnit: shelf });
  const shelfId = shelf.unitId;
  const itemsCount =
    shelf.itemCount ?? (shelf as { items?: unknown[] }).items?.length ?? 0;

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {canEdit && shelfId && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.common_edit()}
            onClick={() => navigate({ to: `/shelf/${shelfId}/edit` })}
            className="h-7 w-7"
          >
            <EditOutlined className="h-4 w-4" />
          </Button>
        )}
      </div>
      {description && (
        <p className="mt-2 text-base text-text-secondary">{description}</p>
      )}
      <div className="mt-2">
        <span className="text-xs text-text-secondary">
          {m.shelf_items_count({ count: itemsCount })}
        </span>
        {shelf.user?.name && (
          <span className="ml-4 text-xs text-text-secondary">
            {m.shelf_by_author({ name: shelf.user.name })}
          </span>
        )}
      </div>
    </div>
  );
};
