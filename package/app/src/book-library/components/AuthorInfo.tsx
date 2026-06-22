import { mainMarkdownSource, type PublicUser } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EditButtonFloatRightShow } from "@rezics/ui/composite/button/EditButtonFloatRight.tsx";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { FollowButton } from "@/engagement";
import { unitHref } from "@/shared/ui/link";
import { useIsMobile } from "@/shared/utils/use-media-query.ts";

// --------- Types 类型 ---------
export type Author = PublicUser;

export type AuthorInfoProps = {
  author: Author;
  /** Whether to show the edit button (routes to author edit page). 是否显示编辑按钮（跳转到作者编辑页面）。 */
  showEditButton?: boolean;
  /** Optional click handler for edit button. 编辑按钮的可选点击处理函数。 */
  onEdit?: () => void;
};

type AuthorInfoLayoutProps = {
  author: Author;
  showEditButton: boolean;
  onEdit: () => void;
};

// --------- AuthorInfo.Mobile 移动端布局 ---------
const AuthorInfoMobile: React.FC<AuthorInfoLayoutProps> = ({
  author,
  showEditButton,
  onEdit,
}) => {
  const { t } = useTranslation(["book", "common"]);
  const description = mainMarkdownSource(author.description);

  return (
    <div>
      <ArrowForwardIcon
        size={16}
        to={unitHref({
          type: "USER",
          unitId: author?.unitId ?? "",
          slug: author?.slug ?? null,
        })}
      >
        <AccentBarWithText
          text={t("book:author_info_author_line", { name: author?.name ?? "" })}
        />
      </ArrowForwardIcon>
      {showEditButton && (
        <EditButtonFloatRightShow onClick={onEdit} text={t("common:edit")} />
      )}
      <div className="flex items-start gap-4 px-4 pt-8">
        {/* Left: Avatar + Follow — 左侧：头像 + 关注 */}
        <div className="flex flex-col items-center w-24 flex-shrink-0">
          <LazyLoadImage
            src={author.avatar || ""}
            alt={t("book:author_avatar_alt", { name: author.name ?? "" })}
            className="w-24 h-24 rounded object-cover shadow-lg"
          />
          <div className="mt-3 w-full">
            <FollowButton
              userId={author?.unitId}
              initialFollowersCount={author.followersCount}
              showFollowersText
              fullWidth
            />
          </div>
        </div>

        {/* Right: text — 右侧：文本 */}
        <div className="flex flex-col flex-1 min-w-0">
          {description && (
            <p className="text-sm leading-relaxed mt-2 line-clamp-4 overflow-hidden">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// --------- AuthorInfo.Desktop 桌面端布局 ---------
const AuthorInfoDesktop: React.FC<AuthorInfoLayoutProps> = ({
  author,
  showEditButton,
  onEdit,
}) => {
  const { t } = useTranslation(["book", "common"]);
  const description = mainMarkdownSource(author.description);

  return (
    <div>
      <div>
        <div className="flex mb-4">
          <ArrowForwardIcon
            size={16}
            to={unitHref({
              type: "USER",
              unitId: author?.unitId ?? "",
              slug: author?.slug ?? null,
            })}
          >
            <AccentBarWithText
              text={t("book:author_info_author_line", {
                name: author?.name ?? "",
              })}
            />
          </ArrowForwardIcon>
          {showEditButton && (
            <EditButtonFloatRightShow
              onClick={onEdit}
              text={t("common:edit")}
            />
          )}
        </div>

        <div className="whitespace-pre-line">
          <div>
            <div className="mb-4 mt-2 flex">
              {/* Left image area — 左侧图片区域 */}
              <div className="w-1/5 flex-row justify-center">
                <LazyLoadImage
                  src={author.avatar || ""}
                  className="max-w-full max-h-full object-contain rounded"
                  alt={t("book:author_avatar_alt", { name: author.name ?? "" })}
                />
                <div className="mt-2 w-full">
                  <FollowButton
                    userId={author?.unitId}
                    initialFollowersCount={author.followersCount}
                    showFollowersText={true}
                    fullWidth
                  />
                </div>
              </div>

              {/* Divider — 分隔线 */}
              <div className="h-auto border-l border-border-defined mx-4" />

              {/* Right text — 右侧文本 */}
              <div className="flex-1 !text-md">
                {description && (
                  <p>
                    {t("book:author_info_description_label")}:{description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------- AuthorInfo 入口组件 ---------
export const AuthorInfo: React.FC<AuthorInfoProps> = ({
  author,
  showEditButton,
  onEdit,
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const canEdit = Boolean(author?.unitId);
  const shouldShowEdit = (showEditButton ?? canEdit) && canEdit;

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    navigate({ to: "/user/me/setting/profile" });
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
