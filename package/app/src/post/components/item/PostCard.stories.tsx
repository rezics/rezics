import { pollKeys } from "@rezics/api/poll/poll.keys";
import {
  markdownContentDocWithPoll,
  type PollResultsDTO,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  postCJK,
  postEmpty,
  postFlat,
  postLatin,
  postLongBody,
} from "@/stories/fixtures/post";
import { PostCard } from "./PostCard";

const POLL_ID = "poll-embed-demo";
const pollResults: PollResultsDTO = {
  pollUnitId: POLL_ID,
  voteMode: "SINGLE",
  resultVisibility: "LIVE",
  anonymous: false,
  closed: false,
  resultsVisible: true,
  totalVotes: 12,
  myVote: ["opt-a"],
  myVoteContexts: [{ optionId: "opt-a", realmUnitId: null }],
  options: [
    {
      pollUnitId: POLL_ID,
      optionId: "opt-a",
      position: "a",
      label: "Yes",
      voteCount: 8,
    },
    {
      pollUnitId: POLL_ID,
      optionId: "opt-b",
      position: "b",
      label: "No",
      voteCount: 4,
    },
  ],
};

/** Seeds the embedded poll into the query cache, then renders the post card. */
function PostCardWithPoll() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    qc.setQueryData(pollKeys.detail(POLL_ID), pollResults);
    setReady(true);
  }, [qc]);
  if (!ready) return null;
  return (
    <PostCard
      post={{
        ...postFlat[0],
        content: markdownContentDocWithPoll("Poll body", POLL_ID),
      }}
    />
  );
}

const meta = {
  title: "Domain/Post/PostCard",
  component: PostCard,
  decorators: [withRouter],
  args: { post: postFlat[0] },
} satisfies Meta<typeof PostCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RootPostWithTitle: Story = {
  args: {
    post: {
      ...postFlat[0],
      title: "Translation-resolved thread title",
    },
  },
};

export const LongContent: Story = {
  args: { post: postLongBody },
};

export const Empty: Story = {
  args: { post: postEmpty },
};

export const LocaleCJK: Story = {
  args: { post: postCJK },
};

export const LocaleLatin: Story = {
  args: { post: postLatin },
};

export const Edited: Story = {
  args: {
    post: {
      ...postFlat[0],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    },
  },
};

export const WithEmbeddedPoll: Story = {
  render: () => <PostCardWithPoll />,
};
