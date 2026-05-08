import type { PublicUser } from "@rezics/contract";
import { EditButtonFloatRightShow } from "@rezics/ui/composite/button/EditButtonFloatRight.tsx";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { FollowButton } from "@/engagement/components/FollowButton.tsx";
import { useIsMobile } from "@/shared/utils/use-media-query.ts";

// --------- Types ---------
export type Author = PublicUser;

export type AuthorInfoProps = {
  author: Author;
  /** Whether to show the edit button (routes to author edit page). */
  showEditButton?: boolean;
  /** Optional click handler for edit button. */
  onEdit?: () => void;
};

type AuthorInfoLayoutProps = {
  author: Author;
  showEditButton: boolean;
  onEdit: () => void;
};

// --------- AuthorInfo.Mobile ---------
const AuthorInfoMobile: React.FC<AuthorInfoLayoutProps> = ({
  author,
  showEditButton,
  onEdit,
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <ArrowForwardIcon size={16} to={`/user/${author?.userId}`}>
        <AccentBarWithText
          text={t("book.author_info.author_line", { name: author?.name })}
        />
      </ArrowForwardIcon>
      {showEditButton && (
        <EditButtonFloatRightShow onClick={onEdit} text={t("common.edit")} />
      )}
      <div className="flex items-start gap-4 px-4 pt-8">
        {/* Left: Avatar + Follow */}
        <div className="flex flex-col items-center w-24 flex-shrink-0">
          <LazyLoadImage
            src={author.avatar || ""}
            alt="avatar"
            className="w-24 h-24 rounded object-cover shadow-lg"
          />
          <div className="mt-3 w-full">
            <FollowButton
              userId={author?.userId}
              initialFollowersCount={author.followersCount}
              showFollowersText
              fullWidth
            />
          </div>
        </div>

        {/* Right: text */}
        <div className="flex flex-col flex-1 min-w-0">
          {author.bio && (
            <p className="text-sm leading-relaxed line-clamp-3 overflow-hidden">
              {author.bio}
            </p>
          )}
          {author.description && (
            <p className="text-sm leading-relaxed mt-2 line-clamp-4 overflow-hidden">
              {author.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// --------- AuthorInfo.Desktop ---------
const AuthorInfoDesktop: React.FC<AuthorInfoLayoutProps> = ({
  author,
  showEditButton,
  onEdit,
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <div>
        <div className="flex mb-4">
          <ArrowForwardIcon size={16} to={`/user/${author?.userId}`}>
            <AccentBarWithText
              text={t("book.author_info.author_line", { name: author?.name })}
            />
          </ArrowForwardIcon>
          {showEditButton && (
            <EditButtonFloatRightShow
              onClick={onEdit}
              text={t("common.edit")}
            />
          )}
        </div>

        <div className="whitespace-pre-line">
          <div>
            <div className="mb-4 mt-2 flex">
              {/* Left image area */}
              <div className="w-1/5 flex-row justify-center">
                <LazyLoadImage
                  src={author.avatar || ""}
                  className="max-w-full max-h-full object-contain rounded"
                  alt="avatar"
                />
                <div className="mt-2 w-full">
                  <FollowButton
                    userId={author?.userId}
                    initialFollowersCount={author.followersCount}
                    showFollowersText={true}
                    fullWidth
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="h-auto border-l border-gray-300 mx-4" />

              {/* Right text */}
              <div className="flex-1 !text-md">
                <p>
                  {t("book.author_info.bio_label")}:{author.bio}
                </p>
                <br />
                <p>
                  {t("book.author_info.description_label")}:{author.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------- AuthorInfo ---------
export const AuthorInfo: React.FC<AuthorInfoProps> = ({
  author,
  showEditButton,
  onEdit,
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const canEdit = Boolean(author?.userId);
  const shouldShowEdit = (showEditButton ?? canEdit) && canEdit;

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    if (author?.userId) {
      navigate({ to: `/user/${author?.userId}/edit` });
    }
  };

  if (isMobile) {
    return (
      <AuthorInfoMobile
        author={author}
        showEditButton={shouldShowEdit}
        onEdit={handleEdit}
      />
    );
  }

  return (
    <AuthorInfoDesktop
      author={author}
      showEditButton={shouldShowEdit}
      onEdit={handleEdit}
    />
  );
};
