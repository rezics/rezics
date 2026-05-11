import type { PostDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { postFlat } from "@/stories/fixtures/post";
import { userAlice } from "@/stories/fixtures/user";
import { PostAuthorHeader } from "./PostAuthorHeader";

const previewAuthor = {
  ...userAlice,
  slug: "alice-mei",
  description:
    "Curates slow-reading shelves and writes careful notes on translated fiction.",
};

const previewPost: PostDTO = {
  ...postFlat[0],
  authorUserId: previewAuthor.userId,
  author: previewAuthor,
};

const anonymousPost: PostDTO = {
  ...postFlat[0],
  authorUserId: "",
  author: undefined,
};

const meta = {
  title: "Domain/Post/PostAuthorHeader",
  component: PostAuthorHeader,
  decorators: [withRouter],
  args: { post: previewPost },
} satisfies Meta<typeof PostAuthorHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { size: "compact" },
};

export const Anonymous: Story = {
  args: { post: anonymousPost },
};
