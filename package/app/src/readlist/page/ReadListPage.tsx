import { ChatBubbleOutline } from "@mui/icons-material";
import { Avatar, IconButton, Tooltip } from "@mui/material";
import { shelfQueries } from "@rezics/api/shelf/shelf";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { SingleCommentElementWrapper } from "@/comment/component/SingleCommentElementWrapper.tsx";
import { TreeReplyComponents } from "@/comment/component/TreeReplyComponents.tsx";
import {
  MiniActionBar,
  MiniAdminActionBar,
} from "@/engagement/component/MiniActionBar.tsx";
import { ReactionStatistics } from "@/engagement/component/ReactionStatistics.tsx";
import { Route } from "@/routes/_mainLayout/readlist/$readlistId";
import { parseReactionSummaries } from "@/shared/util/reaction-summaries-parser";
import { getTranslation } from "@/shared/util/translation-helpers";

/**
 * ReadListPage - now backed by Shelf API instead of Readlist API.
 * ShelfDTO has translations[] instead of top-level title/content.
 */
export const ReadListPage: React.FC = () => {
  const { readlistId } = Route.useParams();
  const commentRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const handleGoToComments = () => {
    commentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const {
    data: shelf,
    isLoading,
    error: _error,
  } = useQuery({
    ...shelfQueries.detail(readlistId || ""),
    enabled: !!readlistId,
  });

  if (isLoading) {
    return <div className="text-center py-10">{t("common.loading")}</div>;
  }

  if (!shelf?.unitId) {
    return (
      <div className="text-center py-10 text-red-500">
        {t("page.readlist.not_found")}
      </div>
    );
  }

  const translation = getTranslation(shelf.translations);
  const shelfTitle = translation?.title ?? '';
  const shelfDescription = translation?.description ?? '';
  const itemCount = shelf.items?.length ?? 0;

  return (
    <div
      className="w-full max-w-4xl mt-[60px] mx-auto px-2"
      data-testid="booklist-page"
    >
      {/* Head */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center">
            <h2 className="text-2xl font-bold">{shelfTitle}</h2>

            <div className="ml-auto">
              <MiniAdminActionBar
                editionURL={`/readlist/${readlistId}/edit`}
                userUnitId={shelf.user?.unitId}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          {shelf.user && (
            <Tooltip
              title={t("page.readlist.open_user_ui")}
              placement="top-start"
            >
              <Link
                to="/user/$unitId"
                params={{ unitId: shelf.user?.unitId }}
                className="flex items-center"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={shelf.user.avatar || ""}
                    alt={shelf.user.name || "Avatar"}
                    variant="rounded"
                    className="shadow"
                  />
                  <p className="text-sm text-gray-700">
                    {shelf.user.name}
                  </p>
                </div>
              </Link>
            </Tooltip>
          )}
          <div className="flex items-center gap-2">
            <MiniActionBar
              handleOnCommentClick={handleGoToComments}
              unitId={readlistId || ""}
            />
          </div>
        </div>
      </div>

      <div>
        {shelfDescription && <div className="mt-4">{shelfDescription}</div>}
      </div>

      {/* Shelf items */}
      {itemCount > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          {t("page.readlist.books_count", { count: itemCount })}
        </div>
      )}

      {/* Likes & Comments */}
      <div className="text-sm mt-5 text-gray-700">
        <ReactionStatistics
          reactionSummaries={parseReactionSummaries(shelf.reactionSummaries)}
        />
      </div>

      {/* MOCK: shelf items display - items reference other units, need further queries */}

      {/* Comments section */}
      <div ref={commentRef} className="mt-5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AccentBar />
            <p className="text-2xl font-bold">{t("page.readlist.comments")}</p>
          </div>

          <SingleCommentElementWrapper replyUnitId={readlistId || ""}>
            <IconButton size="large" sx={{ fontSize: "1.5rem" }}>
              <ChatBubbleOutline fontSize="inherit" />
            </IconButton>
          </SingleCommentElementWrapper>
        </div>

        <TreeReplyComponents unitId={readlistId || ""} />
        <div className="mb-[200px]" />
      </div>
    </div>
  );
};

export default ReadListPage;
