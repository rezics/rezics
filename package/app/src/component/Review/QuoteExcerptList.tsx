import { useQuery } from "urql";
import { Box, Link, Stack } from "@mui/material";
import { SingleQuoteExcerpt } from "@component/Review/SingleQuoteExcerpt";
import { QuoteExcerpt } from "@/api/bookQuoteExcerpt";

export function QuoteExcerptList({ data }: { data: QuoteExcerpt[] }) {
    return (
        <div>
            {/* Quotes */}
            <Box>
                <Stack spacing={2}>
                    {(data || []).map((quote: QuoteExcerpt) => (
                        <SingleQuoteExcerpt key={quote.id} content={quote.content} />
                    ))}
                </Stack>
            </Box>
        </div>
    );
}
