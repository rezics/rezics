import { Box, Chip, Divider, Typography } from "@mui/material";
import { userKeywordQueries } from "@rezics/api/shelf/shelf.queries";
import { realmQueries } from "@rezics/api/realm/realm.queries";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";

interface OverviewSidebarProps {
  user: UserDTO;
  unitId: string;
  isCurrentUser: boolean;
}

export const OverviewSidebar: FC<OverviewSidebarProps> = ({
  user,
  unitId,
  isCurrentUser,
}) => {
  const keywordsQuery = useQuery({
    ...userKeywordQueries.mine(),
    enabled: isCurrentUser,
  });

  const realmsQuery = useQuery({
    ...realmQueries.mine(),
    enabled: isCurrentUser,
  });

  const shelvesCountQuery = useQuery({
    ...contentSearchQueryOptions({
      type: ["SHELF"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  const reviewsCountQuery = useQuery({
    ...contentSearchQueryOptions({
      type: ["POST"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  const keywords = keywordsQuery.data ?? [];
  const realms = (realmsQuery.data as any[]) ?? [];

  return (
    <div className="flex flex-col gap-5 py-4">
      {/* Stats */}
      <div>
        <Typography variant="subtitle2" className="font-semibold mb-2">
          Stats
        </Typography>
        <div className="flex flex-col gap-1">
          <StatLink
            label="Shelves"
            count={shelvesCountQuery.data?.total}
            to={`/user/${unitId}/shelves`}
          />
          <StatLink
            label="Content"
            count={reviewsCountQuery.data?.total}
            to={`/user/${unitId}/content`}
          />
          <StatLink
            label="Followers"
            count={user.followersCount ?? 0}
            to={`/user/${unitId}/followers`}
          />
          <StatLink
            label="Following"
            count={user.followingsCount ?? 0}
            to={`/user/${unitId}/followers?filter=following`}
          />
        </div>
      </div>

      {/* Keywords */}
      {isCurrentUser && keywords.length > 0 && (
        <>
          <Divider />
          <div>
            <Typography variant="subtitle2" className="font-semibold mb-2">
              Keywords
            </Typography>
            <div className="flex flex-wrap gap-1">
              {keywords.slice(0, 20).map((kw: string) => (
                <Chip key={kw} label={kw} size="small" variant="outlined" />
              ))}
              {keywords.length > 20 && (
                <Chip
                  label={`+${keywords.length - 20} more`}
                  size="small"
                  variant="outlined"
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Realms */}
      {isCurrentUser && realms.length > 0 && (
        <>
          <Divider />
          <div>
            <Typography variant="subtitle2" className="font-semibold mb-2">
              Realms
            </Typography>
            <div className="flex flex-col gap-1">
              {realms.map((realm: any) => (
                <Link
                  key={realm.unitId}
                  to="/realm/$realmId"
                  params={{ realmId: realm.unitId }}
                  className="no-underline"
                >
                  <Box className="flex items-center justify-between py-1 hover:bg-gray-50 rounded px-1">
                    <Typography variant="body2" color="text.primary">
                      {realm.translations?.[0]?.title ?? realm.unitId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {realm.memberCount ?? 0} members
                    </Typography>
                  </Box>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatLink: FC<{
  label: string;
  count: number | undefined;
  to: string;
}> = ({ label, count, to }) => (
  <Link to={to} className="no-underline">
    <Box className="flex items-center justify-between py-0.5 hover:bg-gray-50 rounded px-1">
      <Typography variant="body2" color="text.primary">
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" className="font-medium">
        {count ?? "—"}
      </Typography>
    </Box>
  </Link>
);
