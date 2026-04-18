import { Box, Stack } from "@mui/material";
import type { UnitDTO, UnitListResponse } from "@rezics/contract";
import type React from "react";
import { SingleExcerptShow } from "./SingleExcerpt";

export type ExcerptListShowProps = {
  data: UnitListResponse;
};

export const ExcerptListShow: React.FC<ExcerptListShowProps> = ({ data }) => {
  return (
    <div>
      <Box>
        <Stack spacing={2}>
          {(Array.isArray(data.units) ? data.units : []).map(
            (excerpt: UnitDTO) => (
              <SingleExcerptShow
                key={excerpt.id}
                author={{
                  unitId: excerpt.user?.unitId || "",
                  name: excerpt.user?.name || "",
                  avatar: excerpt.user?.avatar || "",
                }}
                content={excerpt.translations?.[0]?.description || ""}
                stats={{
                  replies: 0,
                  likes: 0,
                  date: excerpt.createdAt?.toString() || "",
                }}
                source={(excerpt.extra as Record<string, any>)?.source ?? ""}
                originalLink={`/excerpt/${excerpt.id}`}
              />
            ),
          )}
        </Stack>
      </Box>
    </div>
  );
};

export type ExcerptListContainerProps = {
  data: UnitListResponse;
};

export const ExcerptListContainer: React.FC<ExcerptListContainerProps> = ({
  data,
}) => {
  return <ExcerptListShow data={data} />;
};
