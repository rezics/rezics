import type {
  ReactionHistoryGivenItem,
  ReactionHistoryReceivedItem,
} from "@rezics/api/reaction/reaction.types";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ReactionList } from "./ReactionList";

const sampleGiven: ReactionHistoryGivenItem[] = [
  {
    id: "g1",
    reaction: "like",
    createdAt: "2026-04-29T10:00:00.000Z",
    target: {
      unitId: "unit-1",
      kind: "post",
      title: "On the impossibility of perfectly translating poetry",
      href: "/post/unit-1",
    },
  },
  {
    id: "g2",
    reaction: "bookmark",
    createdAt: "2026-04-22T08:30:00.000Z",
    target: {
      unitId: "unit-2",
      kind: "book",
      title: "百年孤獨",
      href: "/book/unit-2",
    },
  },
  {
    id: "g3",
    reaction: "heart",
    createdAt: "2026-04-15T19:42:00.000Z",
    target: {
      unitId: "unit-3",
      kind: "remark",
      snippet: "A brief note on Borges' garden of forking paths…",
      href: "/post/unit-3",
    },
  },
];

const sampleReceived: ReactionHistoryReceivedItem[] = [
  {
    id: "r1",
    reaction: "like",
    createdAt: "2026-05-02T14:11:00.000Z",
    target: {
      unitId: "unit-7",
      kind: "review",
      title: "Notes on Calvino's Invisible Cities",
      href: "/post/unit-7",
    },
    actor: {
      userId: "u-alice",
      displayName: "Alice Lin",
      avatarUrl: "https://i.pravatar.cc/64?u=alice",
      href: "/u/alice",
    },
  },
  {
    id: "r2",
    reaction: "insightful",
    createdAt: "2026-05-01T09:08:00.000Z",
    target: {
      unitId: "unit-8",
      kind: "excerpt",
      snippet: "「我們是時間的奴隸,亦是時間的造物。」",
      href: "/post/unit-8",
    },
    actor: {
      userId: "u-bo",
      displayName: "Bo Chen",
      href: "/u/bo",
    },
  },
];

const sampleGivenDeleted: ReactionHistoryGivenItem[] = [
  {
    id: "gd1",
    reaction: "like",
    createdAt: "2026-04-12T11:00:00.000Z",
    target: null,
  },
  ...sampleGiven.slice(0, 2),
];

const noop = () => {};

const meta = {
  title: "Domain/User/ReactionList",
  component: ReactionList,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ReactionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Given: Story = {
  args: {
    mode: "given",
    items: sampleGiven,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: noop,
    error: null,
    refetch: noop,
  },
};

export const Received: Story = {
  args: {
    mode: "received",
    items: sampleReceived,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: noop,
    error: null,
    refetch: noop,
  },
};

export const Empty: Story = {
  args: {
    mode: "given",
    items: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: noop,
    error: null,
    refetch: noop,
  },
};

export const DeletedTarget: Story = {
  args: {
    mode: "given",
    items: sampleGivenDeleted,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: noop,
    error: null,
    refetch: noop,
  },
};

export const PrivateProfile: Story = {
  args: {
    mode: "given",
    items: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: noop,
    error: new Error("This profile is private."),
    refetch: noop,
  },
};
