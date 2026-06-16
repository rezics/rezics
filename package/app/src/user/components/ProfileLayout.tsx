import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { createContext, type FC, useContext } from "react";
import { useUserProfileStore } from "@/user/states";
import { ProfileBasicInfo } from "./ProfileBasicInfo";
import { ProfileShell } from "./ProfileShell";

interface ProfileContextValue {
  user: UserDTO;
  isCurrentUser: boolean;
  userId: string;
  profileRoute:
    | { kind: "id"; userId: string }
    | { kind: "slug"; userSlug: string };
  profileBasePath: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx)
    throw new Error("useProfileContext must be used within ProfileLayout");
  return ctx;
}

/**
 * 用户资料主布局，包含侧边栏和内容区的响应式容器。
 * User profile main layout with responsive sidebar and content area.
 *
 * Mobile (<640px):
 * +------------------+
 * | 用户基本信息      |
 * +------------------+
 * | 资料内容         |
 * +------------------+
 *
 * Tablet (640-1023px):
 * +------------------+
 * | 基本信息 | 资料  |
 * |         | 内容  |
 * +------------------+
 *
 * Desktop (1024-1535px):
 * +----------+------------------+
 * | 基本信息 |   资料内容       |
 * | (280px)  |   (flex)         |
 * +----------+------------------+
 *
 * Ultra-wide (>=1536px):
 * +----------+------------------+
 * | 基本信息 |   资料内容       |
 * | (280px)  |   (max-width)    |
 * +----------+------------------+
 *
 * 全宽约束 max-w-12/16 保留两侧内边距，水平响应从堆叠到 md 及以上并排。
 * Keeps max-width constraint with horizontal padding; stacks on mobile, side-by-side on md+.
 */
export const ProfileLayout: FC = () => {
  const { t } = useTranslation(["settings"]);
  const { userId: routeUserId, userSlug } = useParams({ strict: false }) as {
    userId?: string;
    userSlug?: string;
  };
  const userSpaceBasePath = routeUserId
    ? `/user/${routeUserId}`
    : userSlug
      ? `/u/${userSlug}`
      : "";
  const profileBasePath = `${userSpaceBasePath}/profile`;
  const profileRoute =
    routeUserId !== undefined
      ? ({ kind: "id", userId: routeUserId } as const)
      : ({ kind: "slug", userSlug: userSlug ?? "" } as const);
  const currentUser = useUserProfileStore((s) => s.user);
  const isCurrentUser = routeUserId
    ? currentUser?.unitId === routeUserId
    : userSlug
      ? currentUser?.slug === userSlug
      : false;

  const meQuery = useQuery({
    ...userQueries.me(),
    enabled: isCurrentUser,
  });
  const detailQuery = useQuery({
    ...userQueries.detail(routeUserId ?? ""),
    enabled: !isCurrentUser && !!routeUserId,
  });
  const slugQuery = useQuery({
    ...userQueries.bySlug(userSlug ?? ""),
    enabled: !isCurrentUser && !routeUserId && !!userSlug,
  });

  const user = (
    isCurrentUser
      ? meQuery.data
      : routeUserId
        ? detailQuery.data
        : slugQuery.data
  ) as UserDTO | undefined;
  const isLoading =
    meQuery.isLoading || detailQuery.isLoading || slugQuery.isLoading;
  const error = meQuery.error ?? detailQuery.error ?? slugQuery.error;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-error-text">
          {error ? t("common:unexpected_error") : t("settings:user_not_found")}
        </p>
      </div>
    );
  }

  return (
    <ProfileContext.Provider
      value={{
        user,
        isCurrentUser,
        userId: user.unitId,
        profileRoute,
        profileBasePath,
      }}
    >
      <div className="w-full max-w-12/16 mx-auto">
        <div className="flex flex-col lg:flex-row lg:gap-12 px-4 pb-12">
          <aside className="w-full lg:w-[280px] lg:shrink-0">
            <ProfileBasicInfo
              user={user}
              isCurrentUser={isCurrentUser}
              userId={user.unitId}
              profileBasePath={profileBasePath}
            />
          </aside>
          <ProfileShell
            isCurrentUser={isCurrentUser}
            profileBasePath={profileBasePath}
          />
        </div>
      </div>
    </ProfileContext.Provider>
  );
};
