import { Box, Stack } from "@mui/material";
import type { UnitDTO, UnitListResponse } from "@rezics/contract";
import type React from "react";
import { SingleQuoteExcerptShow } from "./SingleQuoteExcerpt";

export type QuoteExcerptListShowProps = {
  data: UnitListResponse;
};

export const QuoteExcerptListShow: React.FC<QuoteExcerptListShowProps> = ({
  data,
}) => {
  return (
    <div>
      {/* Quotes */}
      <Box>
        <Stack spacing={2}>
          {(Array.isArray(data.units) ? data.units : []).map(
            (quote: UnitDTO) => (
              <SingleQuoteExcerptShow
                key={quote.id}
                author={{
                  unitId: quote.user?.unitId || "",
                  name: quote.user?.name || "",
                  avatar: quote.user?.avatar || "",
                }}
                content={quote.content || ""}
                stats={{
                  replies: 0,
                  likes: 0,
                  date: quote.createdAt?.toString() || "",
                }}
                source={quote.metadata?.source || ""}
                originalLink={`/quote/${quote.id}`}
              />
            ),
          )}
        </Stack>
      </Box>
    </div>
  );
};

export type QuoteExcerptListContainerProps = {
  data: UnitListResponse;
};

export const QuoteExcerptListContainer: React.FC<
  QuoteExcerptListContainerProps
> = ({ data }) => {
  return <QuoteExcerptListShow data={data} />;
};
