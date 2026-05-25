import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { unitHref } from "@/shared/ui/link";
import { useUserProfileStore } from "@/user/states";
import { useMessage } from "@rezics/i18n/react";
import {
  profile_follow_info_description,
  profile_follow_info_title,
  user_cannot_resolve,
  user_cannot_resolve_description,
  user_empty,
} from "@rezics/i18n/messages";
const m = {
  profile_follow_info_description,
  profile_follow_info_title,
  user_cannot_resolve,
  user_cannot_resolve_description,
  user_empty,
};

const i18nMessages = {
  profile_follow_info_description,
  profile_follow_info_title,
  user_cannot_resolve,
  user_cannot_resolve_description,
  user_empty,
};

type SimpleUser = Omit<UserDTO, "email">;

type FollowInfoPageProps = {
  unitId?: string;
  isCurrentUser?: boolean;
};

const ITEMS_PER_PAGE = 20;
const EXTERNAL_ITEMS_PER_PAGE = 20;

function FollowUserList({ users }: { users: SimpleUser[] }) {
  const m = useMessage(i18nMessages);
  if (users.length === 0) {
    return (
      <div className="py-16 text-center text-text-secondary">
        {m.user_empty()}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border-whisper">
      {users.map((user) => (
        <li key={user.unitId} className="flex items-center gap-3 py-3">
          <Avatar>
            <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback>
              {user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-text-primary">
              {user.name || user.slug || user.unitId}
            </span>
            {user.slug && (
              <span className="block text-sm text-text-secondary">
                @{user.slug}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export const FollowInfoPage: React.FC<FollowInfoPageProps> = ({
  unitId,
  isCurrentUser = false,
}) => {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
  const currentUser = useUserProfileStore((state) => state.user);
  const resolvedUnitId = useMemo(
    () => unitId || (isCurrentUser ? currentUser?.unitId : unitId),
    [unitId, isCurrentUser, currentUser?.unitId],
  );

  const [tab, setTab] = useState<"following" | "followers">("following");
  const [currentPage, setCurrentPage] = useState(1);
  const [externalPage, setExternalPage] = useState(1);
  const paginatorRef = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

  const followersQuery = useQuery({
    ...userQueries.followers(resolvedUnitId || "", {
      page: externalPage,
      limit: EXTERNAL_ITEMS_PER_PAGE,
    }),
    enabled: !!resolvedUnitId,
  });

  const followingsQuery = useQuery({
    ...userQueries.followings(resolvedUnitId || "", {
      page: externalPage,
      limit: EXTERNAL_ITEMS_PER_PAGE,
    }),
    enabled: !!resolvedUnitId,
  });

  const isLoading = followersQuery.isLoading || followingsQuery.isLoading;
  const error = (followersQuery.error ?? followingsQuery.error) as Error | null;

  const followers = followersQuery.data?.users ?? [];
  const followersTotal = followersQuery.data?.total ?? 0;

  const followings = followingsQuery.data?.users ?? [];
  const followingsTotal = followingsQuery.data?.total ?? 0;

  const activeUsers = tab === "following" ? followings : followers;
  const activeTotal = tab === "following" ? followingsTotal : followersTotal;

  const handleNeedMoreData = (page: number) => {
    setExternalPage(page);
  };

  const handlePreRequestData = async (page: number): Promise<number> => {
    if (!resolvedUnitId) return 0;

    if (tab === "following") {
      const data = await queryClient.fetchQuery(
        userQueries.followings(resolvedUnitId, {
          page,
          limit: EXTERNAL_ITEMS_PER_PAGE,
        }),
      );
      return data.users?.length ?? 0;
    }

    const data = await queryClient.fetchQuery(
      userQueries.followers(resolvedUnitId, {
        page,
        limit: EXTERNAL_ITEMS_PER_PAGE,
      }),
    );
    return data.users?.length ?? 0;
  };

  if (!resolvedUnitId) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-32 text-center">
        <h6 className="text-base font-semibold">{m.user_cannot_resolve()}</h6>
        <p className="text-sm text-text-secondary">
          {m.user_cannot_resolve_description()}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-32">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-11/12 mx-auto mt-16 px-4">
      <div className="flex items-center justify-between">
        <div className="mb-4">
          <h5 className="text-xl font-bold mb-2">
            {m.profile_follow_info_title()}
          </h5>
          <p className="text-sm text-text-secondary">
            {m.profile_follow_info_description()}
          </p>
        </div>
        <Button
          variant="ghost"
          className="text-text-brand"
          onClick={() =>
            navigate({
              to: currentUser?.unitId
                ? unitHref({
                    type: "USER",
                    unitId: currentUser.unitId,
                    slug: currentUser.slug ?? null,
                  })
                : "/user/me",
            })
          }
        >
          返回
        </Button>
      </div>

      <Card className="shadow-sm rounded-xl">
        <div className="px-4">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as "following" | "followers");
              setCurrentPage(1);
              paginatorRef.current?.resetPaginationPageNumber();
            }}
          >
            <TabsList>
              <TabsTrigger value="following">
                我关注的 ({followingsTotal})
              </TabsTrigger>
              <TabsTrigger value="followers">
                关注我的 ({followersTotal})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <CardContent>
          <UniversalPaginator<SimpleUser>
            ref={paginatorRef}
            data={activeUsers}
            totalExternalItems={activeTotal}
            itemsPerPage={ITEMS_PER_PAGE}
            externalItemsPerPage={EXTERNAL_ITEMS_PER_PAGE}
            sortType="time"
            sortOrder="desc"
            onSortChange={() => {}}
            requestData={handleNeedMoreData}
            preRequestData={handlePreRequestData}
            isLoading={isLoading && activeUsers.length === 0}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            sortControl={(<div />) as React.ReactElement<any>}
          >
            {(items: SimpleUser[]) => <FollowUserList users={items} />}
          </UniversalPaginator>
        </CardContent>
      </Card>
    </div>
  );
};

export default FollowInfoPage;
