import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useState } from "react";
import { InlinePostForm } from "@/discussion/components/InlinePostForm";
import { ReplyDrawer } from "@/discussion/components/ReplyDrawer";
import { ThreadList } from "@/discussion/components/ThreadList";
import { BookDetailShell } from "../sections/BookDetailSection";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";

const CommunitySidebar: React.FC = () => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Typography variant="subtitle1" fontWeight={600} mb={1}>
      Community
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Hot threads and active contributors will appear here.
    </Typography>
  </Paper>
);

/**
 * Community tab — discussion threads for the book.
 * (Routed at `/book/$bookId/discussion`; the tab label is "Community".)
 */
export const BookCommunityPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [replyTo, setReplyTo] = useState<string | null>(null);

  if (!bookInfo) return null;

  return (
    <BookDetailShell bookInfo={bookInfo} sidebar={<CommunitySidebar />}>
      <Stack spacing={3}>
        <Box className="lg:hidden">
          <CommunitySidebar />
        </Box>

        <InlinePostForm targetUnitId={bookId} />

        <Divider />

        <ThreadList targetUnitId={bookId} onReply={setReplyTo} />

        {replyTo && (
          <ReplyDrawer
            parentPostUnitId={replyTo}
            isOpen={!!replyTo}
            onClose={() => setReplyTo(null)}
          />
        )}
      </Stack>
    </BookDetailShell>
  );
};

// Backward-compatible alias used by existing route files.
export const BookDiscussionPage = BookCommunityPage;
