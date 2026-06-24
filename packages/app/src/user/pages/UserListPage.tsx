import { userQueries } from "@rezics/contract/api/user/user.queries";
import { useTranslation } from "@rezics/i18n/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, unitHref } from "@/shared/ui/link";
import { UserError, UserLoading } from "./UserState";

/**
 * UserListPage - user list page.
 * UserListPage - 用户列表页面。
 * Shows all users with search and pagination support.
 * 显示所有用户，支持搜索和分页。
 */
export const UserListPage: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const itemsPerPage = 20;

  // Debounce search query.
  // 对搜索查询进行防抖。
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on search — 搜索时重置回第一页
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = useMemo(() => {
    const query: Record<string, string> = {
      page: page.toString(),
      limit: itemsPerPage.toString(),
    };
    if (debouncedQuery) query.q = debouncedQuery;
    return query;
  }, [page, debouncedQuery]);

  const { data, isLoading, error } = useQuery(userQueries.list(queryParams));
  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  const handlePageChange = (value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <div className="w-full px-4 mt-16">
      <h3 className="text-3xl font-bold mb-8">
        {t("settings:user_list_title")}
      </h3>

      <div className="mb-8 relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        <Input
          className="pl-10"
          placeholder={t("settings:user_search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading && <UserLoading />}

      {error && <UserError message={(error as Error).message} />}

      {!isLoading && !error && users.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <h6 className="text-lg text-text-secondary">
            {t("settings:user_none_found")}
          </h6>
        </div>
      )}

      {!isLoading && !error && users.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {users.map((user) => (
              <Link
                key={user.unitId}
                to={unitHref({
                  type: "USER",
                  unitId: user.unitId,
                  slug: user.slug ?? null,
                })}
                className="no-underline"
              >
                <Card
                  surface="contained"
                  className="h-full cursor-pointer transition-colors hover:bg-surface-subtle"
                >
                  <CardContent className="text-center pt-6">
                    <Avatar className="w-16 h-16 mx-auto mb-3">
                      <AvatarImage
                        src={user.avatar ?? undefined}
                        alt={user.name ?? ""}
                      />
                      <AvatarFallback>
                        {user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h6 className="text-base font-semibold mb-2">
                      {user.name}
                    </h6>
                    {user.slug && (
                      <Badge variant="outline" className="mb-2">
                        @{user.slug}
                      </Badge>
                    )}
                    {user.summary && (
                      <p className="text-sm text-text-secondary line-clamp-2">
                        {user.summary}
                      </p>
                    )}
                    {!user.summary && (
                      <p className="text-sm text-text-secondary italic">
                        {t("settings:user_no_summary")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-12">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => handlePageChange(Math.max(1, page - 1))}
              >
                {t("common:previous_page")}
              </Button>
              <span className="text-sm text-text-secondary px-2">
                {t("common:page_of", { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                {t("common:next_page")}
              </Button>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-text-secondary">
              {t("common:showing_range", {
                start: (page - 1) * itemsPerPage + 1,
                end: Math.min(page * itemsPerPage, total),
                total,
              })}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
