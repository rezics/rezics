import { Box, Typography } from "@mui/material";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { ContentSearchDocument } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";

interface OverviewMainProps {
  unitId: string;
}

export const OverviewMain: FC<OverviewMainProps> = ({ unitId }) => {
  // MOCK: pinned items — first 6 published units by this user
  const pinnedQuery = useQuery(
    contentSearchQueryOptions({
      sort: { field: "publishedAt", order: "desc" },
      limit: 6,
    }),
  );

  // MOCK: recent activity — latest published units
  const recentQuery = useQuery(
    contentSearchQueryOptions({
      sort: { field: "updatedAt", order: "desc" },
      limit: 10,
    }),
  );

  const pinned = pinnedQuery.data?.items ?? [];
  const recent = recentQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Pinned Items */}
      <div>
        <Typography variant="subtitle2" className="font-semibold mb-3">
          Pinned
        </Typography>
        {pinned.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pinned.map((item: ContentSearchDocument) => (
              <PinnedCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No pinned items yet
          </Typography>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <Typography variant="subtitle2" className="font-semibold mb-3">
          Recent Activity
        </Typography>
        {recent.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recent.map((item: ContentSearchDocument) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No recent activity
          </Typography>
        )}
      </div>
    </div>
  );
};

// MOCK: pinned card component
const PinnedCard: FC<{ item: ContentSearchDocument }> = ({ item }) => {
  const title =
    item.translations?.[0]?.title ?? item.type ?? "Untitled";

  return (
    <Link to="/unit/$unitId" params={{ unitId: item.id }} className="no-underline">
      <Box className="border border-gray-200 rounded-lg p-3 hover:border-gray-400 transition-colors">
        <Typography variant="caption" color="text.secondary" className="uppercase">
          {item.type}
        </Typography>
        <Typography
          variant="body2"
          className="font-medium mt-1 line-clamp-2"
          color="text.primary"
        >
          {title}
        </Typography>
      </Box>
    </Link>
  );
};

// MOCK: activity item component
const ActivityItem: FC<{ item: ContentSearchDocument }> = ({ item }) => {
  const title =
    item.translations?.[0]?.title ?? item.type ?? "Untitled";
  const date = item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString()
    : "";

  return (
    <Box className="flex items-center gap-3 py-1">
      <Typography variant="caption" color="text.secondary" className="uppercase min-w-[60px]">
        {item.type}
      </Typography>
      <Typography variant="body2" className="flex-1 truncate" color="text.primary">
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {date}
      </Typography>
    </Box>
  );
};
