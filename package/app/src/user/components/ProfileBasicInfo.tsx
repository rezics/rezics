import { useCanEdit } from "@rezics/api/hooks";
import type { UserDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@rezics/ui/shadcn";
import { Pencil as EditOutlined, Settings as SettingsIcon } from "lucide-react";
import type { FC } from "react";
import { BlockPeerAction, DMAction, FollowButton } from "@/engagement";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { Link } from "@/shared/ui/link";
import { ProfileStatLink } from "./ProfileOverviewCards";

interface ProfileBasicInfoProps {
  user: UserDTO;
  isCurrentUser: boolean;
  userId: string;
  profileBasePath?: string;
}

export const ProfileBasicInfo: FC<ProfileBasicInfoProps> = ({
  user,
  isCurrentUser,
  userId,
  profileBasePath = `/user/${userId}/profile`,
}) => {
  const { t } = useTranslation(["settings"]);
  const canEdit = useCanEdit({
    resource: "unit",
    ownerUnit: { user: { unitId: user.unitId } },
  });
  const shelvesCountQuery = useLocalizedContentSearch({
    userId,
    type: ["SHELF"],
    sort: { field: "createdAt", order: "desc" },
    limit: 0,
  });

  const reviewsCountQuery = useLocalizedContentSearch({
    userId,
    type: ["POST"],
    sort: { field: "createdAt", order: "desc" },
    limit: 0,
  });
  const canEditOwnProfile = isCurrentUser && canEdit;

  return (
    <>
      {/* Mobile: compact horizontal layout */}
      {/* 移动端：紧凑的横向布局 */}
      <div className="relative flex items-start gap-4 py-4 px-4 md:hidden">
        {isCurrentUser && (
          <Link to="/user/me/setting" className="absolute top-3 right-3">
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("settings:title")}
              className="h-8 w-8"
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </Link>
        )}
        <Avatar className="w-[72px] h-[72px] rounded-md text-3xl">
          <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h6 className="text-base font-semibold">{user.name}</h6>
            {canEditOwnProfile && (
              <Link to="/user/me/setting/profile">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("settings:profile_edit_title")}
                  className="h-8 w-8"
                >
                  <EditOutlined className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
          {user.slug && (
            <span className="block text-sm text-text-secondary">
              @{user.slug}
            </span>
          )}
          <div className="mt-1 flex items-center gap-3 text-sm text-text-secondary">
            <span className="min-w-0 truncate">
              <strong className="font-medium text-text-primary">
                {user.followersCount ?? 0}
              </strong>{" "}
              {t("settings:profile_tab_followers")}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="min-w-0 truncate">
              <strong className="font-medium text-text-primary">
                {user.followingsCount ?? 0}
              </strong>{" "}
              {t("settings:profile_following")}
            </span>
          </div>
          {user.bio && (
            <p className="text-sm text-text-secondary mt-2 line-clamp-2">
              {user.bio}
            </p>
          )}
          {!isCurrentUser && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FollowButton userId={user.unitId} size="sm" variant="default" />
              <DMAction peerUserId={user.unitId} peerName={user.name} />
              <BlockPeerAction peerUserId={user.unitId} showLabel={false} />
            </div>
          )}
        </div>
      </div>

      {/* Desktop: generous vertical layout */}
      {/* 桌面端：宽松的纵向布局 */}
      <div className="hidden md:flex flex-col items-start gap-4 py-12 px-4">
        <Avatar className="w-full h-auto aspect-square rounded-lg text-5xl">
          <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div>
          <h5 className="text-xl font-semibold">{user.name}</h5>
          {user.slug && (
            <span className="block text-sm text-text-secondary mt-0.5">
              @{user.slug}
            </span>
          )}
        </div>

        {user.bio && (
          <p className="text-sm text-text-secondary max-w-xs">{user.bio}</p>
        )}

        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span>
            <strong className="font-medium text-text-primary">
              {user.followersCount ?? 0}
            </strong>{" "}
            {t("settings:profile_tab_followers")}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>
            <strong className="font-medium text-text-primary">
              {user.followingsCount ?? 0}
            </strong>{" "}
            {t("settings:profile_following")}
          </span>
        </div>

        <div className="w-full">
          {canEditOwnProfile ? (
            <Link to="/user/me/setting/profile" className="block">
              <Button variant="outline" size="sm" className="w-full">
                {t("settings:profile_edit_title")}
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col gap-2">
              <FollowButton
                userId={user.unitId}
                size="default"
                variant="default"
                fullWidth
              />
              <DMAction
                peerUserId={user.unitId}
                peerName={user.name}
                className="w-full justify-center"
              />
              <BlockPeerAction
                peerUserId={user.unitId}
                className="w-full justify-center"
              />
            </div>
          )}
        </div>

        {/* Stats — desktop only, shown in sidebar */}
        {/* 统计数据 — 仅桌面端，显示在侧边栏中 */}
        <div className="w-full mt-4 flex flex-col gap-2">
          <span className="text-sm font-semibold mb-1">
            {t("settings:profile_stats")}
          </span>
          <ProfileStatLink
            label={t("settings:profile_tab_shelves")}
            count={shelvesCountQuery.data?.total}
            to={`${profileBasePath}/shelves`}
          />
          <ProfileStatLink
            label={t("settings:profile_tab_content")}
            count={reviewsCountQuery.data?.total}
            to={`${profileBasePath}/content`}
          />
          <ProfileStatLink
            label={t("settings:profile_tab_followers")}
            count={user.followersCount ?? 0}
            to={`${profileBasePath}/followers`}
          />
          <ProfileStatLink
            label={t("settings:profile_following")}
            count={user.followingsCount ?? 0}
            to={`${profileBasePath}/followers?filter=following`}
          />
        </div>
      </div>
    </>
  );
};
