import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { userAlice } from "@/stories/fixtures/user";
import { UserHoverPreview } from "./UserHoverPreview";

const defaultUser = {
  ...userAlice,
  slug: "alice-mei",
  isFollowing: false,
  description:
    "Curates slow-reading shelves and posts careful notes on translation, memory, and public libraries.",
};

const meta = {
  title: "Domain/User/UserHoverPreview",
  component: UserHoverPreview,
  decorators: [withRouter],
  parameters: {
    layout: "centered",
  },
  args: {
    user: defaultUser,
    defaultOpen: true,
  },
} satisfies Meta<typeof UserHoverPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MissingOptionalFields: Story = {
  args: {
    user: {
      unitId: "user-minimal",
      name: "Mina Park",
      avatar: null,
    },
  },
};

export const LongDisplayData: Story = {
  args: {
    user: {
      unitId: "user-long",
      slug: "reader-of-very-long-serials-and-annotated-editions",
      name: "Alexandria Theodora Penelope Versewright-Liang",
      avatar: null,
      summary:
        "Writes unusually long reading notes about marginalia, serialized publication schedules, translation drift, and how editions change the shape of a reader's memory across decades.",
      followersCount: 987654,
      followingsCount: 12345,
    },
  },
};

export const FollowingState: Story = {
  args: {
    user: {
      ...defaultUser,
      unitId: "user-followed",
      name: "Cora Lim",
      slug: "cora-lim",
      isFollowing: true,
    },
  },
};

export const CompactTrigger: Story = {
  args: {
    size: "compact",
  },
};
