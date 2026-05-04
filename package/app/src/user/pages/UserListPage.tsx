import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
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
import { UserError, UserLoading } from "./UserState";

export interface UserListPageProps {
  onUserClick?: (unitId: string) => void;
}

/**
 * UserListPage - 用户列表页面
 * 显示所有用户，支持搜索和分页
 */
export const UserListPage: FC<UserListPageProps> = ({ onUserClick }) => {
  const [users, setUsers] = useState<Omit<UserDTO, "email">[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const itemsPerPage = 20;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on search
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

  useEffect(() => {
    if (data) {
      setUsers(data.users);
      setTotal(data.total);
    }
  }, [data]);

  const handlePageChange = (value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUserClick = (unitId: string) => {
    if (onUserClick) {
      onUserClick(unitId);
    } else {
      window.location.href = `/users/${unitId}`;
    }
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <div className="w-11/12 mx-auto mt-16">
      <h3 className="text-3xl font-bold mb-8">Users</h3>

      <div className="mb-8 relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        <Input
          className="pl-10"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading && <UserLoading />}

      {error && <UserError message={(error as Error).message} />}

      {!isLoading && !error && users.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <h6 className="text-lg text-text-secondary">No users found</h6>
        </div>
      )}

      {!isLoading && !error && users.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {users.map((user) => (
              <Card
                key={user.unitId}
                className="shadow-md rounded-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => handleUserClick(user.unitId)}
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
                  {user.bio && (
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {user.bio}
                    </p>
                  )}
                  {!user.bio && (
                    <p className="text-sm text-text-secondary italic">
                      No bio
                    </p>
                  )}
                </CardContent>
              </Card>
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
                Previous
              </Button>
              <span className="text-sm text-text-secondary px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-text-secondary">
              Showing {(page - 1) * itemsPerPage + 1} -{" "}
              {Math.min(page * itemsPerPage, total)} of {total} users
            </p>
          </div>
        </>
      )}
    </div>
  );
};
