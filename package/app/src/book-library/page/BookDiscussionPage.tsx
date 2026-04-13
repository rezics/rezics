import { Divider, Stack, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useState } from "react";
import { InlinePostForm } from "@/discussion/component/InlinePostForm";
import { ReplyDrawer } from "@/discussion/component/ReplyDrawer";
import { ThreadList } from "@/discussion/component/ThreadList";
import { BookDetailShell } from "../section/BookDetailSection";
import { bookDetailAtomFamily } from "../state/bookDetailAtoms";

export const BookDiscussionPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [replyTo, setReplyTo] = useState<string | null>(null);

  if (!bookInfo) return null;

  return (
    <BookDetailShell bookInfo={bookInfo}>
      <Stack spacing={3}>
        <Typography variant="h6" fontWeight={600}>
          Discussion
        </Typography>

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
