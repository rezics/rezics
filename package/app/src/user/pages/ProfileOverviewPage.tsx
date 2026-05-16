import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { ContentSearchDocument } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { DescriptionBox } from "@/user/components/DescriptionBox";
import { useProfileContext } from "@/user/components/ProfileLayout";

export const ProfileOverviewPage: FC = () => {
  const { user, userId } = useProfileContext();

  // MOCK: pinned items — first 6 published units by this user
  const pinnedQuery = useQuery(
    contentSearchQueryOptions({
      userId,
      sort: { field: "publishedAt", order: "desc" },
      limit: 6,
    }),
  );

  // MOCK: recent activity — latest published units
  const recentQuery = useQuery(
    contentSearchQueryOptions({
      userId,
      sort: { field: "updatedAt", order: "desc" },
      limit: 10,
    }),
  );

  const shelvesCountQuery = useQuery({
    ...contentSearchQueryOptions({
      userId,
      type: ["SHELF"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  const reviewsCountQuery = useQuery({
    ...contentSearchQueryOptions({
      userId,
      type: ["POST"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  const pinned = pinnedQuery.data?.items ?? [];
  const recent = recentQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-8 py-4">
      {/* Mobile stats — hidden on desktop (shown in sidebar) */}
      <div className="md:hidden flex flex-wrap gap-4 text-sm">
        <StatItem
          label="Shelves"
          count={shelvesCountQuery.data?.total}
          to={`/user/${userId}/shelves`}
        />
        <StatItem
          label="Content"
          count={reviewsCountQuery.data?.total}
          to={`/user/${userId}/content`}
        />
        <StatItem
          label="Followers"
          count={user.followersCount ?? 0}
          to={`/user/${userId}/followers`}
        />
        <StatItem
          label="Following"
          count={user.followingsCount ?? 0}
          to={`/user/${userId}/followers?filter=following`}
        />
      </div>

      {/* DESCRIPTION.md */}
      {user.description && user.description.trim() !== "" && (
        <DescriptionBox content={user.description} />
      )}

      {/* Pinned Items */}
      <div>
        <h6 className="text-sm font-semibold mb-3">Pinned</h6>
        {pinned.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pinned.map((item: ContentSearchDocument) => (
              <PinnedCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No pinned items yet</p>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h6 className="text-sm font-semibold mb-3">Recent Activity</h6>
        {recent.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recent.map((item: ContentSearchDocument) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No recent activity</p>
        )}
      </div>
    </div>
  );
};

const StatItem: FC<{
  label: string;
  count: number | undefined;
  to: string;
}> = ({ label, count, to }) => (
  <Link to={to} className="no-underline">
    <span className="text-gray-500 hover:text-gray-700">
      <strong className="text-gray-900">{count ?? "—"}</strong> {label}
    </span>
  </Link>
);

// MOCK: pinned card component
const PinnedCard: FC<{ item: ContentSearchDocument }> = ({ item }) => {
  const title = item.translations?.[0]?.title ?? item.type ?? "Untitled";

  return (
    <Link
      to="/unit/$unitId"
      params={{ unitId: item.id }}
      search={{ view: "auto" }}
      className="no-underline"
    >
      <div className="border border-gray-200 rounded-lg p-3 hover:border-gray-400 transition-colors">
        <span className="block text-xs uppercase text-text-secondary">
          {item.type}
        </span>
        <span className="block text-sm font-medium mt-1 line-clamp-2 text-text-primary">
          {title}
        </span>
      </div>
    </Link>
  );
};

// MOCK: activity item component
const ActivityItem: FC<{ item: ContentSearchDocument }> = ({ item }) => {
  const title = item.translations?.[0]?.title ?? item.type ?? "Untitled";
  const date = item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString()
    : "";

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs uppercase min-w-[60px] text-text-secondary">
        {item.type}
      </span>
      <span className="text-sm flex-1 truncate text-text-primary">{title}</span>
      <span className="text-xs text-text-secondary">{date}</span>
    </div>
  );
};
